"""
seed_ipc.py — Load ipc.json into MongoDB ipc_sections collection.

ipc.json contains newline-separated JSON objects (not a JSON array),
so we parse each top-level object individually.

Run: python seed_ipc.py
"""
import json
import os
import re
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from app.db.connection import ipc_collection


def _parse_ipc_json(filepath: str) -> list:
    """
    Parse ipc.json which contains newline-separated JSON objects
    (not wrapped in a JSON array). Each section is a standalone {...} block.
    """
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Strategy: find each top-level { ... } block using brace counting
    documents = []
    i = 0
    n = len(content)

    while i < n:
        # Skip whitespace
        while i < n and content[i] in (' ', '\t', '\n', '\r', ','):
            i += 1
        if i >= n:
            break

        if content[i] == '{':
            # Find matching closing brace
            depth = 0
            start = i
            in_string = False
            escape = False

            while i < n:
                ch = content[i]
                if escape:
                    escape = False
                    i += 1
                    continue
                if ch == '\\' and in_string:
                    escape = True
                    i += 1
                    continue
                if ch == '"' and not escape:
                    in_string = not in_string
                elif not in_string:
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            i += 1
                            break
                i += 1

            obj_str = content[start:i]
            try:
                obj = json.loads(obj_str)
                documents.append(obj)
            except json.JSONDecodeError as e:
                print(f"[WARN] Skipping malformed JSON object at position {start}: {e}")
        else:
            i += 1

    return documents


def seed_ipc():
    ipc_file = Path(__file__).parent / "data" / "ipc.json"
    if not ipc_file.exists():
        print(f"[ERROR] ipc.json not found at {ipc_file}")
        return

    print(f"[INFO] Parsing IPC data from {ipc_file}...")
    ipc_data = _parse_ipc_json(str(ipc_file))
    print(f"[INFO] Parsed {len(ipc_data)} IPC sections from ipc.json")

    if not ipc_data:
        print("[ERROR] No IPC sections found. Check the file format.")
        return

    # Drop existing and re-seed
    count_before = ipc_collection.count_documents({})
    if count_before > 0:
        print(f"[INFO] Dropping {count_before} existing IPC documents...")
        ipc_collection.drop()

    # Normalize documents to a consistent schema
    docs = []
    for entry in ipc_data:
        doc = {
            "section_number": str(entry.get("section_number", "")),
            "title": entry.get("title", ""),
            "chapter": entry.get("chapter", ""),
            "act_name": entry.get("act_name", "Indian Penal Code, 1860"),
            "section_type": entry.get("section_type", ""),
            # Map section_text → description for consistency with BNS schema
            "description": entry.get("section_text", entry.get("description", "")),
            "section_text": entry.get("section_text", ""),
            # Map meaning → simple_explanation
            "simple_explanation": entry.get("meaning", entry.get("ai_summary", "")),
            "meaning": entry.get("meaning", ""),
            "punishment": entry.get("punishment"),
            "max_punishment": entry.get("max_punishment"),
            "has_punishment": entry.get("has_punishment", False),
            "keywords": entry.get("keywords", []),
            "key_points": entry.get("key_points", []),
            "legal_significance": entry.get("legal_significance", ""),
            "example": entry.get("example", ""),
            "historical_note": entry.get("historical_note", ""),
            "related_sections": entry.get("related_sections", []),
            "offence_category": entry.get("offence_category", ""),
            "faqs": entry.get("faqs", []),
            "ai_summary": entry.get("ai_summary", ""),
            # Additional fields that may exist
            "illustrations": entry.get("illustrations", []),
            "important_concepts": entry.get("important_concepts", []),
            "cognizable": entry.get("cognizable"),
            "bailable": entry.get("bailable"),
            "compoundable": entry.get("compoundable"),
            "law_code": "IPC",
        }
        docs.append(doc)

    if docs:
        result = ipc_collection.insert_many(docs)
        print(f"[OK] Inserted {len(result.inserted_ids)} IPC sections into MongoDB 'ipc_sections' collection")

        # Create indexes for fast lookups and text search
        ipc_collection.create_index("section_number")
        ipc_collection.create_index("chapter")
        ipc_collection.create_index("offence_category")
        ipc_collection.create_index([
            ("title", "text"),
            ("description", "text"),
            ("section_text", "text"),
            ("meaning", "text"),
            ("keywords", "text"),
            ("ai_summary", "text"),
        ])
        print("[OK] Indexes created on ipc_sections")
    else:
        print("[WARN] No documents to insert")


if __name__ == "__main__":
    seed_ipc()
