import json
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "ai_legal_system")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
laws_col = db["laws"]

# Clear existing laws
laws_col.delete_many({})

data_path = os.path.join("data", "bns_ipc_laws.json")
if os.path.exists(data_path):
    with open(data_path, "r", encoding="utf-8") as f:
        laws = json.load(f)
        if isinstance(laws, list):
            laws_col.insert_many(laws)
            print(f"[+] Inserted {len(laws)} laws from bns_ipc_laws.json")
        else:
            print("[-] Error: JSON is not a list")

# Create text index for search
laws_col.create_index([
    ("title", "text"),
    ("description", "text"),
    ("simple_explanation", "text"),
    ("keywords", "text")
])
print("[+] Created text index for laws")
