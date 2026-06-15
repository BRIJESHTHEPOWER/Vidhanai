"""
create_mapping.py — Create BNS↔IPC section mappings and enrich MongoDB documents.

Intelligently links BNS 2023 sections to their corresponding IPC 1860 sections
using title similarity and semantic matching. Updates MongoDB with the mappings.

Run: python create_mapping.py
"""
import json
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from difflib import SequenceMatcher

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()

from app.db.connection import bns_collection, ipc_collection


def load_json_data(filepath: str) -> List[Dict]:
    """Load JSON data from file."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_newline_json(filepath: str) -> List[Dict]:
    """Load newline-separated JSON objects (for IPC)."""
    documents = []
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    i = 0
    n = len(content)
    while i < n:
        # Skip whitespace and commas
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
            except json.JSONDecodeError as e:
                print(f"[WARN] Skipping malformed JSON at position {start}: {e}")
        else:
            i += 1

    return documents


def normalize_text(text: str) -> str:
    """Normalize text for matching (lowercase, remove special chars, collapse spaces)."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)  # Remove special characters
    text = re.sub(r'\s+', ' ', text).strip()  # Collapse whitespace
    return text


def similarity_score(text1: str, text2: str) -> float:
    """Calculate text similarity using SequenceMatcher."""
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)
    if not norm1 or not norm2:
        return 0.0
    return SequenceMatcher(None, norm1, norm2).ratio()


def find_ipc_match(bns_section: Dict, ipc_sections: List[Dict], threshold: float = 0.6) -> Tuple[Dict, float]:
    """
    Find the best matching IPC section for a given BNS section.
    Returns (matched_ipc_section, score) or (None, 0) if no match found.
    """
    bns_title = bns_section.get("title", "")
    bns_desc = bns_section.get("description", "")
    bns_keywords = bns_section.get("keywords", [])

    best_match = None
    best_score = 0

    for ipc_section in ipc_sections:
        ipc_title = ipc_section.get("title", "")
        ipc_desc = ipc_section.get("section_text", "") or ipc_section.get("description", "")

        # Score based on title similarity (most important)
        title_score = similarity_score(bns_title, ipc_title) * 0.5
        
        # Score based on description similarity
        desc_score = similarity_score(bns_desc[:200], ipc_desc[:200]) * 0.3
        
        # Score based on keyword overlap
        keyword_score = 0
        if bns_keywords:
            ipc_keywords = ipc_section.get("keywords", [])
            overlap = len(set(bns_keywords) & set(ipc_keywords))
            keyword_score = (overlap / len(bns_keywords)) * 0.2 if bns_keywords else 0

        total_score = title_score + desc_score + keyword_score

        if total_score > best_score:
            best_score = total_score
            best_match = ipc_section

    if best_score >= threshold:
        return best_match, best_score
    return None, 0


def create_mappings() -> Dict[str, str]:
    """
    Create BNS↔IPC mappings by matching sections.
    Returns dict mapping BNS section number → IPC section number.
    """
    print("[INFO] Loading BNS data...")
    bns_file = Path(__file__).parent / "data" / "bns.json"
    bns_data = load_json_data(str(bns_file))
    print(f"[INFO] Loaded {len(bns_data)} BNS sections")

    print("[INFO] Loading IPC data...")
    ipc_file = Path(__file__).parent / "data" / "ipc.json"
    ipc_data = load_newline_json(str(ipc_file))
    print(f"[INFO] Loaded {len(ipc_data)} IPC sections")

    mappings = {}
    successful = 0
    
    print("[INFO] Building BNS↔IPC mappings...")
    for bns_section in bns_data:
        bns_num = str(bns_section.get("section_number", ""))
        if not bns_num or bns_num == "N/A":
            continue

        matched_ipc, score = find_ipc_match(bns_section, ipc_data, threshold=0.5)
        
        if matched_ipc:
            ipc_num = str(matched_ipc.get("section_number", ""))
            if ipc_num and ipc_num != "N/A":
                mappings[bns_num] = ipc_num
                successful += 1
                if score > 0.7:
                    confidence = "HIGH"
                elif score > 0.5:
                    confidence = "MEDIUM"
                else:
                    confidence = "LOW"
                
                if successful <= 10:  # Show first 10 mappings
                    print(f"  BNS {bns_num} ({bns_section.get('title', '')[:40]}) → IPC {ipc_num} (score: {score:.2f}, {confidence})")

    print(f"[OK] Created {successful} mappings out of {len(bns_data)} BNS sections\n")
    return mappings


def enrich_mongodb(mappings: Dict[str, str]):
    """Update MongoDB BNS collection with IPC section mappings."""
    print("[INFO] Enriching MongoDB with IPC mappings...")
    
    updated = 0
    failed = 0
    
    for bns_num, ipc_num in mappings.items():
        try:
            result = bns_collection.update_one(
                {"section_number": bns_num},
                {"$set": {"ipc_section": ipc_num}},
                upsert=False
            )
            if result.matched_count > 0:
                updated += 1
            else:
                print(f"[WARN] No BNS section {bns_num} found in MongoDB")
                failed += 1
        except Exception as e:
            print(f"[ERROR] Failed to update BNS {bns_num}: {e}")
            failed += 1

    print(f"[OK] Updated {updated} BNS documents with IPC mappings")
    if failed > 0:
        print(f"[WARN] Failed to update {failed} documents")


def verify_mappings():
    """Verify that the mappings were applied correctly."""
    print("\n[INFO] Verifying mappings...")
    
    enriched_count = bns_collection.count_documents({"ipc_section": {"$exists": True, "$ne": "N/A"}})
    total_count = bns_collection.count_documents({})
    
    print(f"[OK] Enriched: {enriched_count}/{total_count} BNS sections have IPC mappings")
    
    # Show a few examples
    print("\n[INFO] Sample mappings:")
    samples = list(bns_collection.find(
        {"ipc_section": {"$exists": True, "$ne": "N/A"}},
        {"section_number": 1, "title": 1, "ipc_section": 1}
    ).limit(5))
    
    for doc in samples:
        print(f"  BNS {doc['section_number']} ({doc['title'][:40]}) → IPC {doc['ipc_section']}")


if __name__ == "__main__":
    try:
        print("=" * 60)
        print("[START] Creating BNS↔IPC mappings")
        print("=" * 60 + "\n")
        
        mappings = create_mappings()
        enrich_mongodb(mappings)
        verify_mappings()
        
        print("\n" + "=" * 60)
        print("[SUCCESS] BNS↔IPC mapping complete!")
        print("=" * 60)
        print("\nNow run the frontend and test the Compare feature.")
        print("The comparison should now return results for crimes like Murder, Theft, etc.")
        
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
