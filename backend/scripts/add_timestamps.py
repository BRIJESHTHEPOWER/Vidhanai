#!/usr/bin/env python
"""
L1: Migration script — adds `created_at` and `updated_at` timestamps
to all Law documents that are missing them.

Run once from the backend/ directory:
    python scripts/add_timestamps.py
"""
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime
from app.db.connection import laws_collection

def run():
    now = datetime.utcnow()
    # Update only documents missing created_at
    result_created = laws_collection.update_many(
        {"created_at": {"$exists": False}},
        {"$set": {"created_at": now, "updated_at": now}},
    )
    print(f"[OK] Added timestamps to {result_created.modified_count} law documents.")

    # Also patch any with created_at but missing updated_at
    result_updated = laws_collection.update_many(
        {"updated_at": {"$exists": False}},
        {"$set": {"updated_at": now}},
    )
    print(f"[OK] Added updated_at to {result_updated.modified_count} more documents.")
    print("[DONE] Timestamp migration complete.")

if __name__ == "__main__":
    run()
