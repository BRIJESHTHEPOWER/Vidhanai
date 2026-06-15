"""
seed_all.py — Unified seed script: BNS + IPC → MongoDB, then rebuild FAISS index.

Run from backend/ directory:
    python seed_all.py

This script:
  1. Seeds BNS data into MongoDB (bns_sections collection)
  2. Seeds IPC data into MongoDB (ipc_sections collection)
  3. Rebuilds the FAISS vector index from both collections
"""
import sys
import subprocess
from pathlib import Path

BACKEND_DIR = Path(__file__).parent


def _run_script(script_name: str, description: str) -> bool:
    """Run a Python script and return True on success."""
    script_path = BACKEND_DIR / script_name
    if not script_path.exists():
        print(f"[ERROR] Script not found: {script_path}")
        return False

    print(f"\n{'='*60}")
    print(f"  Step: {description}")
    print(f"  Script: {script_name}")
    print(f"{'='*60}")

    result = subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(BACKEND_DIR),
    )
    success = result.returncode == 0
    if not success:
        print(f"[ERROR] {script_name} failed with exit code {result.returncode}")
    return success


def main():
    print("╔══════════════════════════════════════════════════╗")
    print("║    Vidhan.ai — Full Database Seed + Index Build  ║")
    print("╚══════════════════════════════════════════════════╝")

    all_ok = True

    # Step 1: Seed BNS
    if not _run_script("seed_bns.py", "Seed BNS 2023 data → MongoDB bns_sections"):
        all_ok = False
        print("[WARN] BNS seeding failed, continuing...")

    # Step 2: Seed IPC
    if not _run_script("seed_ipc.py", "Seed IPC 1860 data → MongoDB ipc_sections"):
        all_ok = False
        print("[WARN] IPC seeding failed, continuing...")

    # Step 3: Rebuild FAISS index
    if not _run_script("vector/build_index.py", "Rebuild FAISS vector index (BNS + IPC)"):
        all_ok = False
        print("[WARN] FAISS index build failed.")

    # Summary
    print(f"\n{'='*60}")
    if all_ok:
        print("  ✅ ALL STEPS COMPLETED SUCCESSFULLY")
    else:
        print("  ⚠️  SOME STEPS FAILED — check output above")
    print(f"{'='*60}")

    # Print final MongoDB counts
    try:
        from app.db.connection import bns_collection, ipc_collection
        bns_count = bns_collection.count_documents({})
        ipc_count = ipc_collection.count_documents({})
        print(f"\n  📊 MongoDB Summary:")
        print(f"     BNS sections: {bns_count}")
        print(f"     IPC sections: {ipc_count}")
        print(f"     Total laws:   {bns_count + ipc_count}")
    except Exception as e:
        print(f"\n  [WARN] Could not query MongoDB for summary: {e}")

    # Print FAISS stats
    try:
        import os, pickle
        map_path = BACKEND_DIR / "vector" / "id_mapping.pkl"
        if map_path.exists():
            with open(map_path, "rb") as f:
                id_map = pickle.load(f)
            bns_v = sum(1 for e in id_map if isinstance(e, dict) and e.get("source") == "bns" or not isinstance(e, dict))
            ipc_v = sum(1 for e in id_map if isinstance(e, dict) and e.get("source") == "ipc")
            print(f"\n  🔍 FAISS Summary:")
            print(f"     Total vectors: {len(id_map)}")
            print(f"     BNS vectors:   {bns_v}")
            print(f"     IPC vectors:   {ipc_v}")
    except Exception as e:
        print(f"\n  [WARN] Could not read FAISS stats: {e}")

    print(f"\n  Next step: python -m uvicorn app.main:app --reload --port 8000")
    print(f"  Health check: GET http://localhost:8000/health\n")


if __name__ == "__main__":
    main()
