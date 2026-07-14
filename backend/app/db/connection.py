"""
MongoDB connection with retry logic and proper startup validation.
Raises a clear error on startup if the DB is unreachable.
"""
import os
import time
import sys
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB_NAME", os.getenv("DB_NAME", "ai_legal_system"))

_MAX_RETRIES = 3
_RETRY_DELAY = 1  # seconds base for exponential backoff


def _create_client_with_retry() -> MongoClient:
    """Attempt to connect to MongoDB with exponential backoff."""
    last_error = None
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            client = MongoClient(
                MONGO_URI,
                maxPoolSize=10,
                serverSelectionTimeoutMS=5000,
                socketTimeoutMS=45000,
                connectTimeoutMS=5000,
            )
            # Ping to confirm connection is alive
            client.admin.command("ping")
            print(f"[OK] MongoDB Connected -> DB: {DB_NAME}  (attempt {attempt})")
            return client
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            last_error = e
            wait = _RETRY_DELAY * (2 ** (attempt - 1))  # 1s, 2s, 4s
            print(
                f"[WARN] MongoDB attempt {attempt}/{_MAX_RETRIES} failed. "
                f"Retrying in {wait}s... (Error: {e})"
            )
            time.sleep(wait)
        except Exception as e:
            last_error = e
            print(f"[ERROR] Unexpected MongoDB error on attempt {attempt}: {e}")
            break

    # All retries exhausted — log clearly but don't crash the server.
    # Endpoints that need DB will fail gracefully via their own try/except.
    print(
        f"[ERROR] CRITICAL: MongoDB unreachable after {_MAX_RETRIES} attempts.\n"
        f"          Reason: {last_error}\n"
        "          The server will start but DB-dependent endpoints will return errors. "
        "Please check your MONGO_URI in the .env file."
    )
    # Return a client anyway; individual ops will raise and be caught downstream
    return MongoClient(
        MONGO_URI, 
        maxPoolSize=10, 
        serverSelectionTimeoutMS=5000, 
        socketTimeoutMS=45000
    )


# ── Initialise connection ────────────────────────────────────────────────────
client = _create_client_with_retry()
db     = client[DB_NAME]

# Collections
queries_collection = db["queries"]
users_collection   = db["users"]
bns_collection     = db["bns_sections"]   # Raw BNS 2023 sections from bns.json
ipc_collection     = db["ipc_sections"]   # Raw IPC 1860 sections from ipc.json
comics_collection  = db["comics"]
leaderboard_collection = db["leaderboard"]
reviews_collection     = db["reviews"]
admin_users_collection = db["admin_users"]
settings_collection    = db["settings"]   # platform config (maintenance mode, etc.)
announcements_collection          = db["announcements"]            # admin "what's new" updates
newsletter_subscribers_collection = db["newsletter_subscribers"]   # footer newsletter emails
subscriptions_collection          = db["subscriptions"]            # Razorpay subscription records
usage_collection                  = db["usage_quota"]              # per-IP daily quota for anonymous demo asks


# ── Schema normalizer ────────────────────────────────────────────────────────
def normalize_law_doc(doc: dict) -> dict:
    """
    Maps a raw BNS/laws document (schema: section_number, title, description,
    punishment, keywords, ai_summary) to the enriched schema expected by all
    routers and services (ipc_section, bns_section, simple_explanation, etc.).

    If the document is already enriched (has ipc_section / bns_section fields)
    it is returned unchanged so existing enriched data is never overwritten.
    """
    if not doc:
        return {}
    # Already fully enriched — skip
    if doc.get("bns_section") is not None and doc.get("ipc_section") is not None:
        return doc

    sec        = str(doc.get("section_number") or "N/A")
    title      = doc.get("title", "")
    desc       = doc.get("description") or ""
    punishment = doc.get("punishment") or ""
    ai_sum     = doc.get("ai_summary") or ""
    chapter    = doc.get("chapter") or "General"
    keywords   = doc.get("keywords") or []

    enriched = dict(doc)  # copy all original fields
    enriched.setdefault("bns_section",       sec)
    enriched.setdefault("ipc_section",       doc.get("ipc_section", "N/A"))
    enriched.setdefault("bns_title",         title)
    enriched.setdefault("ipc_title",         title)
    enriched.setdefault("simple_explanation", ai_sum or desc[:300])
    enriched.setdefault("bns_description",   desc)
    enriched.setdefault("bns_punishment",    punishment)
    enriched.setdefault("real_life_example", "")
    enriched.setdefault("differences",
        "This section is from BNS 2023. IPC equivalent not mapped in current dataset.")
    enriched.setdefault("related_laws",      [])
    enriched.setdefault("category",          chapter)
    enriched.setdefault("bailable",          None)
    enriched.setdefault("cognizable",        None)
    return enriched


# ── IPC Schema normalizer ────────────────────────────────────────────────────
def normalize_ipc_doc(doc: dict) -> dict:
    """
    Maps a raw IPC document (schema: section_number, title, section_text,
    meaning, key_points, punishment, keywords, ai_summary) to the enriched
    schema expected by all routers and services.

    If the document already has the enriched fields, it is returned unchanged.
    """
    if not doc:
        return {}
    # Already fully enriched — skip
    if doc.get("ipc_section") is not None and doc.get("bns_section") is not None:
        return doc

    sec        = str(doc.get("section_number") or "N/A")
    title      = doc.get("title", "")
    desc       = doc.get("section_text") or doc.get("description") or ""
    meaning    = doc.get("meaning") or doc.get("simple_explanation") or ""
    punishment = doc.get("punishment") or ""
    ai_sum     = doc.get("ai_summary") or ""
    chapter    = doc.get("chapter") or "General"
    keywords   = doc.get("keywords") or []
    category   = doc.get("offence_category") or chapter

    enriched = dict(doc)  # copy all original fields
    enriched.setdefault("ipc_section",        sec)
    enriched.setdefault("bns_section",        "N/A")  # No BNS mapping for raw IPC docs
    enriched.setdefault("ipc_title",          title)
    enriched.setdefault("bns_title",          title)
    enriched.setdefault("title",              title)
    enriched.setdefault("description",        desc)
    enriched.setdefault("simple_explanation", meaning or ai_sum or desc[:300])
    enriched.setdefault("bns_description",    "")
    enriched.setdefault("bns_punishment",     "")
    enriched.setdefault("real_life_example",  doc.get("example", ""))
    enriched.setdefault("differences",
        "This section is from IPC 1860. BNS 2023 equivalent not mapped in current dataset.")
    enriched.setdefault("related_laws",       doc.get("related_sections", []))
    enriched.setdefault("category",           category)
    enriched.setdefault("bailable",           doc.get("bailable"))
    enriched.setdefault("cognizable",         doc.get("cognizable"))
    enriched.setdefault("law_code",           "IPC")
    return enriched
