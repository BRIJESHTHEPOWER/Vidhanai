"""
setup_comparison.py — Complete setup for the comparison feature.

This script:
1. Seeds BNS sections from bns.json
2. Seeds IPC sections from ipc.json  
3. Creates BNS↔IPC mappings
4. Verifies the comparison feature works

Run: python setup_comparison.py
"""
import json
import re
import sys
from pathlib import Path
from typing import List, Dict
from difflib import SequenceMatcher

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from app.db.connection import bns_collection, ipc_collection


def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def similarity_score(text1: str, text2: str) -> float:
    """Calculate text similarity."""
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)
    if not norm1 or not norm2:
        return 0.0
    return SequenceMatcher(None, norm1, norm2).ratio()


def load_json_data(filepath: str) -> List[Dict]:
    """Load standard JSON array."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_newline_json(filepath: str) -> List[Dict]:
    """Load newline-separated JSON objects."""
    documents = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    i = 0
    n = len(content)
    while i < n:
        while i < n and content[i] in (' ', '\t', '\n', '\r', ','):
            i += 1
        if i >= n:
            break

        if content[i] == '{':
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
            except json.JSONDecodeError:
                pass
        else:
            i += 1

    return documents


def seed_bns():
    """Seed BNS collection from bns.json."""
    print("\n" + "="*60)
    print("[1/3] SEEDING BNS COLLECTION")
    print("="*60)
    
    bns_file = Path(__file__).parent / "data" / "bns.json"
    if not bns_file.exists():
        print(f"[ERROR] {bns_file} not found")
        return False

    try:
        bns_data = load_json_data(str(bns_file))
        print(f"[INFO] Loaded {len(bns_data)} BNS sections from bns.json")

        # Clear and re-seed
        bns_collection.drop()
        print("[INFO] Cleared existing BNS collection")

        # Normalize and insert
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
                "important_definitions": entry.get("important_definitions", []),
                "grounds": entry.get("grounds", []),
                "exceptions": entry.get("exceptions", []),
            }
            docs.append(doc)

        result = bns_collection.insert_many(docs)
        print(f"[OK] Inserted {len(result.inserted_ids)} BNS sections")

        # Create indexes
        bns_collection.create_index("section_number")
        bns_collection.create_index("chapter")
        bns_collection.create_index([("title", "text"), ("description", "text"), ("keywords", "text")])
        print("[OK] Created indexes")
        
        return True
    except Exception as e:
        print(f"[ERROR] BNS seeding failed: {e}")
        return False


def seed_ipc():
    """Seed IPC collection from ipc.json."""
    print("\n" + "="*60)
    print("[2/3] SEEDING IPC COLLECTION")
    print("="*60)
    
    ipc_file = Path(__file__).parent / "data" / "ipc.json"
    if not ipc_file.exists():
        print(f"[ERROR] {ipc_file} not found")
        return False

    try:
        ipc_data = load_newline_json(str(ipc_file))
        print(f"[INFO] Loaded {len(ipc_data)} IPC sections from ipc.json")

        if not ipc_data:
            print("[ERROR] No IPC sections found")
            return False

        # Clear and re-seed
        ipc_collection.drop()
        print("[INFO] Cleared existing IPC collection")

        # Normalize and insert
        docs = []
        for entry in ipc_data:
            doc = {
                "section_number": str(entry.get("section_number", "")),
                "title": entry.get("title", ""),
                "section_text": entry.get("section_text", entry.get("description", "")),
                "meaning": entry.get("meaning", entry.get("simple_explanation", "")),
                "key_points": entry.get("key_points", []),
                "punishment": entry.get("punishment", ""),
                "keywords": entry.get("keywords", []),
                "offence_category": entry.get("offence_category", ""),
                "ai_summary": entry.get("ai_summary", ""),
                "chapter": entry.get("chapter", ""),
            }
            docs.append(doc)

        result = ipc_collection.insert_many(docs)
        print(f"[OK] Inserted {len(result.inserted_ids)} IPC sections")

        # Create indexes
        ipc_collection.create_index("section_number")
        ipc_collection.create_index([("title", "text"), ("section_text", "text"), ("keywords", "text")])
        print("[OK] Created indexes")
        
        return True
    except Exception as e:
        print(f"[ERROR] IPC seeding failed: {e}")
        return False


def create_mappings(bns_data: List[Dict], ipc_data: List[Dict]):
    """Create BNS↔IPC mappings."""
    print("\n" + "="*60)
    print("[3/3] CREATING BNS-IPC MAPPINGS")
    print("="*60)
    
    mappings = {}
    successful = 0
    
    print(f"[INFO] Matching {len(bns_data)} BNS sections to IPC sections...")
    
    for bns_section in bns_data:
        bns_num = str(bns_section.get("section_number", ""))
        if not bns_num or bns_num == "N/A":
            continue

        bns_title = bns_section.get("title", "")
        bns_desc = bns_section.get("description", "")[:200]
        bns_keywords = set(bns_section.get("keywords", []))

        best_match = None
        best_score = 0

        # Find best IPC match
        for ipc_section in ipc_data:
            ipc_title = ipc_section.get("title", "")
            ipc_desc = ipc_section.get("section_text", "")[:200]
            ipc_keywords = set(ipc_section.get("keywords", []))

            # Score based on: title (50%), description (30%), keywords (20%)
            title_score = similarity_score(bns_title, ipc_title) * 0.5
            desc_score = similarity_score(bns_desc, ipc_desc) * 0.3
            keyword_overlap = len(bns_keywords & ipc_keywords) / len(bns_keywords) if bns_keywords else 0
            keyword_score = keyword_overlap * 0.2

            # Boost if title is a direct substring of the other (e.g., "Murder" in "Punishment for murder")
            if bns_title and ipc_title and (bns_title.lower() in ipc_title.lower() or ipc_title.lower() in bns_title.lower()):
                title_score += 0.2

            total_score = title_score + desc_score + keyword_score

            if total_score > best_score:
                best_score = total_score
                best_match = ipc_section

        # Accept matches with score >= 0.45 or if there was a strong title boost
        if best_match and (best_score >= 0.45 or (best_score > 0.35 and title_score > 0.3)):
            ipc_num = str(best_match.get("section_number", ""))
            if ipc_num and ipc_num != "N/A":
                mappings[bns_num] = ipc_num
                successful += 1
                
                if successful <= 10:
                    conf = "HIGH" if best_score > 0.7 else "MED" if best_score > 0.5 else "LOW"
                    print(f"  * BNS {bns_num} -> IPC {ipc_num} ({conf}, {best_score:.2f})")

    print(f"\n[OK] Created {successful} mappings ({(successful/len(bns_data)*100):.1f}% coverage)")
    
    return mappings


def enrich_mongodb(mappings: Dict[str, str]):
    """Update BNS collection with IPC mappings."""
    print(f"\n[INFO] Enriching {len(mappings)} BNS documents with IPC mappings...")
    
    updated = 0
    for bns_num, ipc_num in mappings.items():
        try:
            result = bns_collection.update_one(
                {"section_number": bns_num},
                {"$set": {"ipc_section": ipc_num}},
                upsert=False
            )
            if result.matched_count > 0:
                updated += 1
        except Exception as e:
            print(f"[WARN] Failed to update BNS {bns_num}: {e}")

    print(f"[OK] Updated {updated} documents with IPC mappings")


def verify():
    """Verify the setup works."""
    print("\n" + "="*60)
    print("[VERIFY] Checking comparison feature")
    print("="*60)
    
    # Check counts
    bns_count = bns_collection.count_documents({})
    ipc_count = ipc_collection.count_documents({})
    enriched_count = bns_collection.count_documents({"ipc_section": {"$exists": True, "$ne": None}})
    
    print(f"\n[OK] BNS sections: {bns_count}")
    print(f"[OK] IPC sections: {ipc_count}")
    print(f"[OK] Enriched (with IPC mapping): {enriched_count}")
    
    # Test search
    print(f"\n[INFO] Testing comparison search...")
    
    # Try to find a murder-related section
    test_docs = list(bns_collection.find({
        "$text": {"$search": "murder"}
    }).limit(3))
    
    if test_docs:
        print(f"[OK] Found {len(test_docs)} results for 'murder' search")
        for doc in test_docs[:2]:
            ipc_sec = doc.get("ipc_section", "N/A")
            print(f"    BNS {doc['section_number']}: {doc['title'][:50]} -> IPC {ipc_sec}")
    else:
        print(f"[WARN] No results for 'murder' search - check data seeding")
    
    print("\n[SUCCESS] Setup complete!")
    print("\nYou can now:")
    print("  1. Start the backend: python main.py")
    print("  2. Open the frontend and go to Compare page")
    print("  3. Search for 'Murder', 'Theft', 'Rape', etc.")
    print("  4. Results should now appear with BNS-IPC comparisons")


def main():
    try:
        print("\n" + "="*60)
        print("VIDHAN.AI COMPARISON FEATURE - COMPLETE SETUP")
        print("="*60)
        
        # Step 1: Seed BNS
        if not seed_bns():
            return
        
        # Step 2: Seed IPC
        if not seed_ipc():
            return
        
        # Step 3: Create mappings
        print("\n[INFO] Loading data for mapping...")
        bns_data = load_json_data(str(Path(__file__).parent / "data" / "bns.json"))
        ipc_data = load_newline_json(str(Path(__file__).parent / "data" / "ipc.json"))
        
        mappings = create_mappings(bns_data, ipc_data)
        enrich_mongodb(mappings)
        
        # Step 4: Verify
        verify()
        
    except Exception as e:
        print(f"\n[ERROR] Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
