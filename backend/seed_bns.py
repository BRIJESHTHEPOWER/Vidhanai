"""
seed_bns.py — Load bns.json into MongoDB bns_sections collection.
Run: python seed_bns.py
"""
import json
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from app.db.connection import bns_collection

def seed_bns():
    bns_file = Path(__file__).parent / "data" / "bns.json"
    if not bns_file.exists():
        print(f"[ERROR] bns.json not found at {bns_file}")
        return

    with open(bns_file, "r", encoding="utf-8") as f:
        bns_data = json.load(f)

    print(f"[INFO] Loaded {len(bns_data)} BNS sections from bns.json")

    # Drop existing and re-seed
    count_before = bns_collection.count_documents({})
    if count_before > 0:
        print(f"[INFO] Dropping {count_before} existing BNS documents...")
        bns_collection.drop()

    # Normalize documents
    docs = []
    for entry in bns_data:
        doc = {
            "section_number": str(entry.get("section_number", "")),
            "title": entry.get("title", ""),
            "chapter": entry.get("chapter", ""),
            "description": entry.get("description", entry.get("content", "")),
            "punishment": entry.get("punishment"),
            "keywords": entry.get("keywords", []),
            "is_punishable": entry.get("is_punishable", False),
            "ai_summary": entry.get("ai_summary", ""),
            "subsections": entry.get("subsections", []),
            "illustrations": entry.get("illustrations", []),
            # Extra fields that may exist
            "important_definitions": entry.get("important_definitions", []),
            "grounds": entry.get("grounds", []),
            "exceptions": entry.get("exceptions", []),
        }
        docs.append(doc)

    if docs:
        result = bns_collection.insert_many(docs)
        print(f"[OK] Inserted {len(result.inserted_ids)} BNS sections into MongoDB 'bns_sections' collection")
        
        # Create index on section_number for fast lookups
        bns_collection.create_index("section_number")
        bns_collection.create_index("chapter")
        bns_collection.create_index([("title", "text"), ("description", "text"), ("keywords", "text")])
        print("[OK] Indexes created on bns_sections")
    else:
        print("[WARN] No documents to insert")


if __name__ == "__main__":
    seed_bns()
