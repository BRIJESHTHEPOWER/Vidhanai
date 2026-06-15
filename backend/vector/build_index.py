"""
Build FAISS vector index from laws in MongoDB — BOTH IPC + BNS collections.
Run from the backend/ directory: python vector/build_index.py
"""
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from pymongo import MongoClient
import pickle
import json
import sys
import os

# --- Config ---
MONGO_URI  = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
DB_NAME    = os.getenv("DB_NAME", "ai_legal_system")
MODEL_NAME = "all-MiniLM-L6-v2"
INDEX_PATH = os.path.join(os.path.dirname(__file__), "law_index.faiss")
MAP_PATH   = os.path.join(os.path.dirname(__file__), "id_mapping.pkl")

# --- Load model ---
print("[*] Loading sentence transformer model...", flush=True)
try:
    model = SentenceTransformer(MODEL_NAME)
except Exception as e:
    print("[!] Failed to load model:", e, flush=True)
    sys.exit(1)

# --- Connect to Mongo ---
print("[*] Connecting to MongoDB...", flush=True)
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    db = client[DB_NAME]
    print("[+] Connected ->", DB_NAME, flush=True)
except Exception as e:
    print("[!] MongoDB connection failed:", e, flush=True)
    sys.exit(1)


def _compose_text_bns(doc: dict) -> str:
    """Compose searchable text from a BNS document."""
    parts = [
        doc.get("title", ""),
        doc.get("description", ""),
        doc.get("simple_explanation", ""),
        doc.get("ai_summary", ""),
        " ".join(doc.get("keywords", [])),
    ]
    return " ".join(p for p in parts if p)


def _compose_text_ipc(doc: dict) -> str:
    """Compose searchable text from an IPC document."""
    parts = [
        doc.get("title", ""),
        doc.get("section_text", ""),
        doc.get("meaning", ""),
        doc.get("description", ""),
        doc.get("simple_explanation", ""),
        doc.get("ai_summary", ""),
        doc.get("legal_significance", ""),
        " ".join(doc.get("keywords", [])),
        " ".join(doc.get("key_points", [])),
    ]
    return " ".join(p for p in parts if p)


# --- Fetch BNS documents ---
bns_collection = db["bns_sections"]
bns_docs = list(bns_collection.find())
print(f"[*] Found {len(bns_docs)} BNS documents", flush=True)

# --- Fetch IPC documents ---
ipc_collection = db["ipc_sections"]
ipc_docs = list(ipc_collection.find())
print(f"[*] Found {len(ipc_docs)} IPC documents", flush=True)

total = len(bns_docs) + len(ipc_docs)
if total == 0:
    print("[!] No documents found in either collection. Please seed the database first.")
    sys.exit(1)

texts = []
id_map = []  # list of {"id": str, "source": "bns"|"ipc"}

# Process BNS documents
for doc in bns_docs:
    text = _compose_text_bns(doc)
    if text.strip():
        texts.append(text)
        id_map.append({"id": str(doc["_id"]), "source": "bns"})

# Process IPC documents
for doc in ipc_docs:
    text = _compose_text_ipc(doc)
    if text.strip():
        texts.append(text)
        id_map.append({"id": str(doc["_id"]), "source": "ipc"})

print(f"[*] Total vectors to build: {len(texts)} (BNS: {len(bns_docs)}, IPC: {len(ipc_docs)})", flush=True)

# --- Build embeddings ---
print("[*] Generating embeddings...")
embeddings = model.encode(texts, show_progress_bar=True)

# --- Create FAISS index ---
dimension = embeddings.shape[1]
index = faiss.IndexFlatL2(dimension)
index.add(np.array(embeddings, dtype=np.float32))
print(f"[+] Index built: {index.ntotal} vectors, dim = {dimension}", flush=True)

# --- Save to temp files ---
temp_index = INDEX_PATH + ".tmp"
temp_map = MAP_PATH + ".tmp"
faiss.write_index(index, temp_index)
with open(temp_map, "wb") as f:
    pickle.dump(id_map, f)

# --- Replace atomic ---
if os.path.exists(INDEX_PATH):
    os.remove(INDEX_PATH)
if os.path.exists(MAP_PATH):
    os.remove(MAP_PATH)
os.rename(temp_index, INDEX_PATH)
os.rename(temp_map, MAP_PATH)

print(f"[+] Saved index -> {INDEX_PATH}", flush=True)
print(f"[+] Saved id map -> {MAP_PATH}", flush=True)
print(f"[+] Vector DB built successfully! ({len(id_map)} vectors)", flush=True)