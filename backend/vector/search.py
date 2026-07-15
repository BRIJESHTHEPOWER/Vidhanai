"""
FAISS vector search — uses absolute paths so it works
no matter which directory uvicorn is launched from.

Supports both BNS and IPC collections via source-tagged id_mapping.

H3 Fix: All init failures are caught gracefully; search() always returns
a list (empty on any error) so callers need no special-case logic.
"""
import os
import pickle
from typing import List

import numpy as np

_DIR        = os.path.dirname(__file__)
INDEX_PATH  = os.path.join(_DIR, "law_index.faiss")
MAP_PATH    = os.path.join(_DIR, "id_mapping.pkl")

# Lazy-loaded globals
_model = None
_index = None
_ids   = None
_init_failed = False   # set True after first failed init so we stop retrying


def _lazy_init() -> bool:
    """
    Load FAISS index and sentence-transformer on first call.
    Returns True on success, False if unavailable (missing files or import error).
    Suppresses all exceptions so the caller gets a bool, not a crash.
    """
    global _model, _index, _ids, _init_failed

    if _model is not None:
        return True          # already initialised
    if _init_failed:
        return False         # previous init failed — skip retrying

    # ── Guard: explicitly disabled (small hosts) ─────────────────────────────
    # Loading PyTorch + MiniLM costs ~400MB RAM, which does not fit a 512MB
    # instance (e.g. Render's free tier). Set DISABLE_VECTOR_SEARCH=true there;
    # the app then uses the MongoDB keyword RAG fallback instead. Checked before
    # the heavy imports below so torch is never even loaded.
    if (os.getenv("DISABLE_VECTOR_SEARCH") or "").strip().lower() in ("1", "true", "yes"):
        print("[INFO] Vector search disabled via DISABLE_VECTOR_SEARCH — using keyword fallback.")
        _init_failed = True
        return False

    # ── Guard: missing index files ───────────────────────────────────────────
    if not os.path.exists(INDEX_PATH):
        print(
            f"[WARN] FAISS index not found at: {INDEX_PATH}\n"
            "    Vector search is DISABLED. Keyword fallback will be used.\n"
            "    To enable: run  python vector/build_index.py  from backend/"
        )
        _init_failed = True
        return False

    if not os.path.exists(MAP_PATH):
        print(
            f"[WARN] FAISS id_mapping not found at: {MAP_PATH}\n"
            "    Vector search is DISABLED."
        )
        _init_failed = True
        return False

    # ── Guard: optional heavy imports ────────────────────────────────────────
    try:
        import faiss
        from sentence_transformers import SentenceTransformer
    except ImportError as e:
        print(
            f"[WARN] Vector search dependencies missing: {e}\n"
            "    Install with:  pip install faiss-cpu sentence-transformers\n"
            "    Falling back to keyword search."
        )
        _init_failed = True
        return False

    # ── Load index ────────────────────────────────────────────────────────────
    try:
        print("[INFO] Loading FAISS index and sentence-transformer model...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        _index = faiss.read_index(INDEX_PATH)
        with open(MAP_PATH, "rb") as f:
            _ids = pickle.load(f)
        print(f"[OK] FAISS ready  ({_index.ntotal} vectors)")
        return True
    except Exception as e:
        print(f"[ERROR] FAISS init error: {e}\n   Falling back to keyword search.")
        _model = _index = _ids = None
        _init_failed = True
        return False


def is_available() -> bool:
    """True when FAISS + the embedding model are actually usable.

    search() returns [] both when nothing is similar enough AND when vector
    search is switched off (DISABLE_VECTOR_SEARCH on small hosts) or failed to
    load. Callers that treat "no results" as a meaningful verdict must check
    this first, or a disabled index looks like "nothing matched".
    """
    return _lazy_init()


def _is_new_format(id_entry) -> bool:
    """Check if id_mapping entry uses the new dict format {"id": ..., "source": ...}."""
    return isinstance(id_entry, dict) and "id" in id_entry and "source" in id_entry


def search(query: str, k: int = 3, max_distance: float = None) -> List[dict]:
    """
    Return up to k law documents relevant to the query string.
    Each result is normalized to the enriched schema (bns_section, ipc_section, etc.)
    Supports both old id_mapping format (list of ObjectId strings) and
    new format (list of {"id": str, "source": "bns"|"ipc"} dicts).
    Returns an empty list if FAISS is unavailable — never raises.

    max_distance: optional L2 cutoff. FAISS always returns the nearest vectors
    however far away they are, so without this an off-topic query still gets a
    confident-looking law back. Measured on all-MiniLM-L6-v2 against this
    dataset: real legal queries land <= ~1.50, off-topic text >= ~1.56.
    Callers that want a "no match" answer should pass ~1.52. Left as None
    (no filtering) by default so existing RAG behaviour is unchanged.
    """
    if not _lazy_init():
        return []

    try:
        from app.db.connection import (
            bns_collection, ipc_collection,
            normalize_law_doc, normalize_ipc_doc,
        )
        from bson import ObjectId

        q_vec = np.array(_model.encode([query]), dtype=np.float32)
        D, I  = _index.search(q_vec, k)

        results = []
        for dist, i in zip(D[0], I[0]):
            if i < 0 or i >= len(_ids):
                continue
            if max_distance is not None and float(dist) > max_distance:
                continue

            entry = _ids[i]

            # Support both old format (plain string) and new format (dict)
            if _is_new_format(entry):
                doc_id = entry["id"]
                source = entry["source"]
            else:
                # Legacy format — plain ObjectId string, assume BNS
                doc_id = entry
                source = "bns"

            # Look up from the correct collection and apply normalizer
            if source == "ipc":
                doc = ipc_collection.find_one({"_id": ObjectId(doc_id)})
                if doc:
                    results.append(normalize_ipc_doc(doc))
            else:
                doc = bns_collection.find_one({"_id": ObjectId(doc_id)})
                if doc:
                    results.append(normalize_law_doc(doc))

        return results
    except Exception as e:
        print(f"[WARN] FAISS search error: {e}")
        return []