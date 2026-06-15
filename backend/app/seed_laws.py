"""
Seed script - loads bns_ipc_laws.json into MongoDB laws_collection
Run: python -m app.seed_laws  (from backend/ directory)
"""
import json
import os
import sys

# ── Allow running from backend/ ──────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.db.connection import laws_collection

def seed():
    BASE_DIR = os.path.dirname(os.path.dirname(__file__))
    file_path = os.path.join(BASE_DIR, "data", "bns_ipc_laws.json")

    with open(file_path, "r", encoding="utf-8") as f:
        laws = json.load(f)

    # Drop existing and re-insert
    laws_collection.drop()
    result = laws_collection.insert_many(laws)
    print(f"[OK] Seeded {len(result.inserted_ids)} laws into MongoDB 'laws' collection.")

    # Create text index for full-text search
    laws_collection.create_index([
        ("title", "text"),
        ("description", "text"),
        ("keywords", "text"),
        ("simple_explanation", "text"),
        ("real_life_example", "text")
    ])
    print("[OK] Text index created on laws collection.")

if __name__ == "__main__":
    seed()
