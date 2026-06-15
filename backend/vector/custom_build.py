"""Temporary script to rebuild FAISS using the vector/build_index.py logic but without loading the model again if it hangs."""
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
from pymongo import MongoClient
import pickle
import sys
import os
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

print("Starting custom faiss builder...", flush=True)

try:
    print("Loading model...", flush=True)
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model loaded!", flush=True)
    
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
    db = client["ai_legal_system"]
    collection = db["bns_sections"]
    docs = list(collection.find())
    print(f"Found {len(docs)} documents", flush=True)
    
    texts = []
    ids = []
    for doc in docs:
        parts = [
            doc.get("title", ""),
            doc.get("description", ""),
            doc.get("simple_explanation", ""),
            " ".join(doc.get("keywords", [])),
        ]
        texts.append(" ".join(p for p in parts if p))
        ids.append(str(doc["_id"]))
        
    print("Generating embeddings...", flush=True)
    embeddings = model.encode(texts)
    
    print("Building index...", flush=True)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(embeddings, dtype=np.float32))
    
    INDEX_PATH = os.path.join(os.path.dirname(__file__), "law_index.faiss")
    MAP_PATH = os.path.join(os.path.dirname(__file__), "id_mapping.pkl")
    
    temp_index = INDEX_PATH + ".tmp"
    temp_map = MAP_PATH + ".tmp"
    faiss.write_index(index, temp_index)
    with open(temp_map, "wb") as f:
        pickle.dump(ids, f)
        
    if os.path.exists(INDEX_PATH): os.remove(INDEX_PATH)
    if os.path.exists(MAP_PATH): os.remove(MAP_PATH)
    os.rename(temp_index, INDEX_PATH)
    os.rename(temp_map, MAP_PATH)
    
    print(f"Done! Built {len(ids)} vectors.", flush=True)
except Exception as e:
    print("Error:", e, flush=True)
