from dotenv import load_dotenv
load_dotenv()   # load backend/.env into os.environ before any other import reads it

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse
import asyncio
import re

# ── Feature routers ───────────────────────────────────────────────────────────
from app.routers.search    import router as search_router
from app.routers.learn     import router as learn_router
from app.routers.quiz      import router as quiz_router
from app.routers.explore   import router as explore_router
from app.routers.history   import router as history_router
from app.routers.awareness import router as awareness_router
from app.routers.voice     import router as voice_router
from app.routers.reviews   import router as reviews_router
from app.routers.admin     import router as admin_router
from app.routers.comic     import router as comic_router
from app.routers.tutor     import router as tutor_router
from app.routers.jd_teach  import router as jd_teach_router
from app.routers.tts       import router as tts_router
from app.routers.announcements import router as announcements_router
from app.routers.subscriptions import router as subscriptions_router
from app.routers.contact    import router as contact_router
from app.auth              import router as auth_router

# ── Vector search ─────────────────────────────────────────────────────────────
from vector.search import search

# ── RAG + AI services ─────────────────────────────────────────────────────────
from app.services.rag import find_relevant_law
from app.services.ai  import generate_ai_response
from app.routers      import sanitize_input, get_all_laws, get_current_user_email_optional
from app.services.plan_gate import enforce_question_quota, require_language_allowed
from fastapi import Depends

# ── Rate limiter (M3) ─────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── Startup & Shutdown Lifecycle ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("==========================================")
    print("[STARTUP] Starting Vidhan.ai Backend...")
    try:
        from app.db.connection import client, DB_NAME, bns_collection, ipc_collection
        client.admin.command("ping")
        print(f"[OK] [MongoDB] Verified connection to database: '{DB_NAME}'")
        # Report collection counts
        bns_count = bns_collection.count_documents({})
        ipc_count = ipc_collection.count_documents({})
        print(f"[OK] [MongoDB] BNS sections: {bns_count} | IPC sections: {ipc_count}")
        if bns_count == 0:
            print("[WARN] [MongoDB] BNS collection is EMPTY — run: python seed_bns.py")
        if ipc_count == 0:
            print("[WARN] [MongoDB] IPC collection is EMPTY — run: python seed_ipc.py")
    except Exception as e:
        print(f"[ERROR] [MongoDB] Connection failed! Database is unreachable.")
    
    try:
        from vector.search import _lazy_init
        _lazy_init()
    except Exception as e:
        print(f"[ERROR] [FAISS] Initialization failed: {e}")

    print("==========================================\n")
    yield
    print("\n[SHUTDOWN] Shutting down Vidhan.ai Backend...")

app = FastAPI(
    title="Vidhan.ai Backend",
    description="AI Legal Awareness System (IPC + BNS)",
    version="2.0.0",
    lifespan=lifespan
)

# Attach limiter to app state so slowapi middleware can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Local dev origins are always allowed. In production set CORS_ORIGINS to a
# comma-separated list of your deployed frontend origins, e.g.
#   CORS_ORIGINS=https://vidhanai.vercel.app,https://www.vidhanai.me
import os as _os

_DEV_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
_env_origins = [
    o.strip().rstrip("/")
    for o in (_os.getenv("CORS_ORIGINS") or "").split(",")
    if o.strip()
]
_ALLOWED_ORIGINS = _DEV_ORIGINS + _env_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    # Allow any Vercel preview deployment (https://<branch>-<hash>.vercel.app).
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print(f"[CORS] Allowed origins: {_ALLOWED_ORIGINS} (+ *.vercel.app)")


# ── Maintenance-mode middleware ───────────────────────────────────────────────
# When admin disables the platform, all non-admin, non-health endpoints return 503.
_BYPASS_PREFIXES = ("/admin", "/health", "/auth", "/")

@app.middleware("http")
async def maintenance_gate(request: Request, call_next):
    path = request.url.path
    # Always allow: admin panel, health check, auth, root
    if any(path == p or path.startswith(p + "/") or path.startswith(p) for p in _BYPASS_PREFIXES if p != "/") or path == "/":
        return await call_next(request)
    try:
        from app.db.connection import settings_collection as _sc
        doc = _sc.find_one({"key": "platform"})
        if doc and not doc.get("enabled", True):
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=503,
                content={"detail": "Platform is currently under maintenance. Please check back later.", "maintenance": True},
            )
    except Exception:
        pass  # DB unavailable — let request through
    return await call_next(request)


# ── Global exception handler (C2) ─────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "status": "error",
            "path": str(request.url),
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────
# `static/` holds runtime-generated files (e.g. comic images), so it can be empty
# or absent on a fresh clone/deploy. Resolve it relative to backend/ (not the
# CWD) and create it if missing, so startup never fails on a missing directory.
_STATIC_DIR = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), "static")
_os.makedirs(_STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")
app.include_router(search_router)
app.include_router(learn_router)
app.include_router(quiz_router)
app.include_router(explore_router)
app.include_router(history_router)
app.include_router(awareness_router)
app.include_router(voice_router)
app.include_router(reviews_router)
app.include_router(admin_router)
app.include_router(comic_router)   # handles POST /comic-story
app.include_router(tutor_router)   # handles /tutor/*
app.include_router(jd_teach_router)  # handles /jd/teach/* (Sarvam voice lessons)
app.include_router(tts_router)       # handles /tts/* (Sarvam TTS)
app.include_router(announcements_router)  # bell feed, newsletter, admin updates
app.include_router(subscriptions_router)  # handles /subscriptions/* (Razorpay)
app.include_router(contact_router)        # handles POST /contact
app.include_router(auth_router)


# ── AI vector search (rate-limited: 30/min per IP) ────────────────────────────
@app.get("/ai-search")
@limiter.limit("30/minute")
def ai_search(request: Request, query: str):
    try:
        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        results = search(query)
        if not results:
            return {"message": "No relevant laws found"}
        return {
            "query": query,
            "results": [
                {
                    "title":       r.get("title"),
                    "ipc_section": r.get("ipc_section"),
                    "bns_section": r.get("bns_section"),
                    "punishment":  r.get("punishment"),
                    "description": r.get("description"),
                }
                for r in results
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /ask  — RAG-powered chat endpoint ────────────────────────────────────────
class AskRequest(BaseModel):
    question: str
    mode:     Optional[str] = "rag"
    language: Optional[str] = "English"


@app.post("/ask")
@limiter.limit("30/minute")
def ask_question(
    request: Request,
    body: AskRequest,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    """
    Non-streaming /ask endpoint for RAG.
    Used as fallback when streaming is unavailable or fails.
    """
    question = sanitize_input(body.question, max_len=1500)
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    language = body.language or "English"

    # Plan gate: Free = 5 questions/day + English only; Pro = unlimited.
    usage = enforce_question_quota(
        user_email, language, request.client.host if request.client else None
    )

    # Try FAISS search first
    context = find_relevant_law(question)
    if not context:
        from app.routers import rag_context_from_db
        context = rag_context_from_db(question)

    if not context:
        no_info = "I couldn't find specific legal information for this question in my database. Please try rephrasing."
        return {"answer": no_info, "context_found": False, "language": language,
                "questions_remaining": usage["remaining"], "plan": usage["plan"]}

    try:
        answer = generate_ai_response(question, context, language)
        return {"answer": answer, "context_found": True, "language": language,
                "questions_remaining": usage["remaining"], "plan": usage["plan"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /ask-stream — Streaming SSE version of /ask ─────────────────────────────
import json as _json

from app.services.ai import generate_ai_response_stream


@app.post("/ask-stream")
@limiter.limit("30/minute")
async def ask_question_stream(
    request: Request,
    body: AskRequest,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    """
    Streaming version of /ask. Returns Server-Sent Events (SSE) so the
    frontend can render tokens as they arrive from Gemini.
    Async — blocking FAISS/RAG search offloaded via to_thread(),
    then Gemini streaming tokens are yielded via an async generator.
    """
    question = sanitize_input(body.question, max_len=1500)
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    language = body.language or "English"

    # Plan gate (raises 403/429 before the stream starts): Free = 5/day, English only.
    usage = await asyncio.to_thread(
        enforce_question_quota,
        user_email, language, request.client.host if request.client else None,
    )

    async def event_stream():
        yield f"data: {_json.dumps({'type': 'status', 'message': 'Searching legal database...'})}\n\n"

        # Offload blocking FAISS/MongoDB search to thread pool
        context = await asyncio.to_thread(find_relevant_law, question)
        if not context:
            from app.routers import rag_context_from_db
            context = await asyncio.to_thread(rag_context_from_db, question)

        if not context:
            no_info = "I couldn't find specific legal information for this question in my database. Please try rephrasing."
            yield f"data: {_json.dumps({'type': 'chunk', 'content': no_info})}\n\n"
            yield f"data: {_json.dumps({'type': 'done', 'context_found': False, 'language': language, 'questions_remaining': usage['remaining'], 'plan': usage['plan']})}\n\n"
            return

        yield f"data: {_json.dumps({'type': 'status', 'message': 'Generating answer...'})}\n\n"

        try:
            # Collect tokens from the blocking Gemini stream generator in a thread
            import queue
            import threading

            token_queue = queue.Queue()
            error_holder = [None]

            def _run_stream():
                try:
                    for token in generate_ai_response_stream(question, context, language):
                        token_queue.put(token)
                except Exception as e:
                    error_holder[0] = e
                finally:
                    token_queue.put(None)  # sentinel

            thread = threading.Thread(target=_run_stream, daemon=True)
            thread.start()

            first_chunk = True
            while True:
                # Non-blocking poll with asyncio sleep to avoid blocking event loop
                token = await asyncio.to_thread(token_queue.get)
                if token is None:
                    break
                if first_chunk:
                    yield f"data: {_json.dumps({'type': 'streaming_start'})}\n\n"
                    first_chunk = False
                yield f"data: {_json.dumps({'type': 'chunk', 'content': token})}\n\n"

            if error_holder[0]:
                yield f"data: {_json.dumps({'type': 'error', 'message': str(error_holder[0])})}\n\n"
                return

        except Exception as e:
            yield f"data: {_json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        yield f"data: {_json.dumps({'type': 'done', 'context_found': True, 'language': language, 'questions_remaining': usage['remaining'], 'plan': usage['plan']})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")



# ── /simplify — Rewrite answer in simple, youth-friendly language ────────────
class SimplifyRequest(BaseModel):
    answer:   str
    question: Optional[str] = ""
    language: Optional[str] = "English"


@app.post("/simplify")
@limiter.limit("30/minute")
def simplify_answer(
    request: Request,
    body: SimplifyRequest,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    """
    Takes a legal AI answer and rewrites it in super-simple,
    youth-friendly language. No jargon, short sentences, relatable.
    Powered by Groq (fast + reliable, avoids the earlier truncation).
    """
    from app.services.ai import generate_groq_text

    ans = sanitize_input(body.answer, max_len=3000)
    if not ans:
        raise HTTPException(status_code=400, detail="Answer cannot be empty")

    # Free plan is English-only — non-English output is a Pro feature.
    require_language_allowed(user_email, body.language)

    system_instruction = f"""You are a legal educator making law super simple for students and teenagers.
Rewrite the provided legal answer in the SIMPLEST possible way.
- Language to output in: {body.language}
- Use everyday language, like you're explaining to a student.
- Use fewer technical terms and very short sentences.
- Use emojis where helpful (but not too many).
- Keep ALL the key facts (the offence, the section numbers, and the punishment) — do not drop them.
- If there are section numbers (like IPC 379 or BNS 303), keep them but explain what they mean simply.
- Write a COMPLETE explanation — never stop mid-sentence.
- NEVER include introductions like "Here is the simplified version" or repeat the instructions. Output ONLY the simplified text."""

    user_text = f"Original legal answer to simplify:\n\n{ans}"

    simplified = generate_groq_text(system_instruction, user_text, temperature=0.35, max_tokens=900)
    if not simplified:
        raise HTTPException(status_code=500, detail="Could not simplify the answer right now. Please try again.")
    return {"simplified": simplified}


# NOTE: POST /comic-story is handled exclusively by app.routers.comic (registered above)


# ── /visualize — Topic graph data endpoint ─────────────────────────────────────
class VisualizeRequest(BaseModel):
    question: str
    answer:   Optional[str] = ""


@app.post("/visualize")
@limiter.limit("20/minute")
def visualize_topic(request: Request, body: VisualizeRequest):
    """
    Returns structured graph data (nodes + edges) for the legal topic
    mentioned in the question/answer pair.
    Nodes represent: main topic, IPC sections, BNS sections, key concepts.
    Edges represent: relationships between them.
    """
    question = sanitize_input(body.question, max_len=500)
    answer   = sanitize_input(body.answer or "", max_len=3000)

    # Find matching laws from DB
    from app.services.rag import find_relevant_law, _format_multi_context
    from app.db.connection import bns_collection
    import re

    # Get top laws for this question
    all_laws_list = get_all_laws()
    words = [w.lower() for w in re.split(r"\W+", question) if len(w) > 2]

    scored = []
    for law in all_laws_list:
        score = 0
        combined = " ".join([
            law.get("title", ""),
            law.get("description", ""),
            " ".join(law.get("keywords", [])),
            str(law.get("ipc_section", "")),
            str(law.get("bns_section", "")),
        ]).lower()
        for w in words:
            if w in combined:
                score += 1
        for kw in law.get("keywords", []):
            if kw.lower() in question.lower():
                score += 3
        if score > 0:
            scored.append((score, law))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_laws = [law for _, law in scored[:4]]

    # Also extract IPC/BNS refs from the answer text
    ipc_refs = re.findall(r'IPC\s*(\d+\w*)', answer, re.IGNORECASE)
    bns_refs = re.findall(r'BNS\s*(\d+\w*)', answer, re.IGNORECASE)

    # Build graph nodes and edges
    nodes = []
    edges = []
    node_ids = set()

    # Central topic node
    topic_label = question[:40] + ("..." if len(question) > 40 else "")
    nodes.append({
        "id": "topic",
        "label": topic_label,
        "type": "topic",
        "color": "#6366f1",
        "size": 28,
    })
    node_ids.add("topic")

    for i, law in enumerate(top_laws):
        ipc = law.get("ipc_section", "")
        bns = law.get("bns_section", "")
        title = law.get("title", "Unknown")
        category = law.get("category", "")
        punishment = law.get("punishment", "")
        keywords = law.get("keywords", [])[:3]

        # IPC node
        ipc_id = f"ipc_{ipc}"
        if ipc and ipc != "N/A" and ipc_id not in node_ids:
            nodes.append({
                "id": ipc_id,
                "label": f"IPC {ipc}",
                "sublabel": title[:30],
                "type": "ipc",
                "color": "#22d3ee",
                "size": 20,
                "detail": {
                    "punishment": punishment,
                    "category": category,
                    "keywords": keywords,
                }
            })
            node_ids.add(ipc_id)
            edges.append({"from": "topic", "to": ipc_id, "label": "covers"})

        # BNS node
        bns_id = f"bns_{bns}"
        if bns and bns != "N/A" and bns_id not in node_ids:
            nodes.append({
                "id": bns_id,
                "label": f"BNS {bns}",
                "sublabel": title[:30],
                "type": "bns",
                "color": "#a78bfa",
                "size": 20,
                "detail": {
                    "punishment": law.get("bns_punishment", punishment),
                    "category": category,
                    "keywords": keywords,
                }
            })
            node_ids.add(bns_id)
            edges.append({"from": "topic", "to": bns_id, "label": "updated to"})

        # IPC → BNS edge
        if ipc and bns and ipc_id in node_ids and bns_id in node_ids:
            edges.append({"from": ipc_id, "to": bns_id, "label": "→ BNS"})

        # Keyword concept nodes
        for kw in keywords:
            kw_id = f"kw_{kw.replace(' ', '_')}"
            if kw_id not in node_ids:
                nodes.append({
                    "id": kw_id,
                    "label": kw,
                    "type": "concept",
                    "color": "#f59e0b",
                    "size": 14,
                })
                node_ids.add(kw_id)
                connect_to = ipc_id if ipc_id in node_ids else bns_id
                if connect_to in node_ids:
                    edges.append({"from": connect_to, "to": kw_id, "label": "related"})

    return {
        "nodes": nodes,
        "edges": edges,
        "topic": topic_label,
        "law_count": len(top_laws),
    }


# ── /unfold-case — Chat → Step-by-step case walkthrough ──────────────────────
class UnfoldRequest(BaseModel):
    question: str
    answer:   Optional[str] = ""


@app.post("/unfold-case")
@limiter.limit("20/minute")
def unfold_case(request: Request, body: UnfoldRequest):
    """
    Given a chat question (and optional AI answer), find the most relevant
    law from the database and generate a 4-step procedural walkthrough:
    Incident → Police Action → Law Applied → Outcome.
    Uses the same scenario generator as the Learn Mode.
    """
    from app.services.scenario import generate_scenario
    from app.db.connection import bns_collection

    question = sanitize_input(body.question, max_len=500)
    answer   = sanitize_input(body.answer or "", max_len=3000)
    if not question and not answer:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    combined_text = f"{question} {answer}"
    all_laws_list = get_all_laws()

    # Common words that must NOT drive the match (otherwise "punishment for X"
    # matches a section literally titled "...punishment...").
    _STOP = {
        "what", "which", "when", "where", "whom", "whose", "punishment", "punishable",
        "section", "sections", "law", "laws", "under", "the", "and", "for", "this",
        "that", "with", "from", "your", "you", "are", "can", "how", "does", "crime",
        "offence", "offense", "act", "case", "person", "people", "bns", "ipc", "india",
        "indian", "legal", "court", "year", "years", "fine", "imprisonment", "previously",
    }

    best_law = None

    # 1. Strongest signal: explicit section numbers cited in the answer/question
    #    (e.g. the RAG answer says "BNS 137" — match that law directly).
    bns_refs = {r.lower() for r in re.findall(r'BNS\s*(?:Section\s*)?(\d+\w*)', combined_text, re.IGNORECASE)}
    ipc_refs = {r.lower() for r in re.findall(r'IPC\s*(?:Section\s*)?(\d+\w*)', combined_text, re.IGNORECASE)}
    if bns_refs or ipc_refs:
        for law in all_laws_list:
            bns_sec = str(law.get("bns_section", "")).lower()
            ipc_sec = str(law.get("ipc_section", "")).lower()
            if (bns_sec and bns_sec in bns_refs) or (ipc_sec and ipc_sec in ipc_refs):
                best_law = law
                break

    # 2. Keyword scoring (question weighted higher than answer; stopwords ignored)
    if best_law is None:
        q_words = [w.lower() for w in re.split(r"\W+", question) if len(w) > 2 and w.lower() not in _STOP]
        a_words = [w.lower() for w in re.split(r"\W+", answer)   if len(w) > 2 and w.lower() not in _STOP]

        scored = []
        for law in all_laws_list:
            blob = " ".join([
                law.get("title", ""),
                law.get("description", ""),
                law.get("simple_explanation", ""),
                " ".join(law.get("keywords", [])),
                str(law.get("ipc_section", "")),
                str(law.get("bns_section", "")),
            ]).lower()
            score = 0
            for w in q_words:
                if w in blob:
                    score += 2   # question terms matter most
            for w in a_words:
                if w in blob:
                    score += 1
            for kw in law.get("keywords", []):
                if kw.lower() in combined_text.lower():
                    score += 4   # a full keyword phrase match is a strong signal
            if score > 0:
                scored.append((score, law))

        scored.sort(key=lambda x: x[0], reverse=True)
        if scored:
            best_law = scored[0][1]

    if best_law is None:
        return {"steps": [], "law": None, "found": False}

    # Generate the 4-step scenario
    steps = generate_scenario(best_law)

    return {
        "found": True,
        "law": {
            "ipc_section":  best_law.get("ipc_section"),
            "bns_section":  best_law.get("bns_section"),
            "title":        best_law.get("title"),
            "category":     best_law.get("category"),
            "punishment":   best_law.get("punishment"),
            "bns_punishment": best_law.get("bns_punishment"),
            "bailable":     best_law.get("bailable"),
        },
        "steps": steps,
    }


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"status": "running", "message": "Vidhan.ai Backend v2 is running"}


@app.get("/test")
def test():
    return {"message": "API working fine"}


# ── A2: Health / readiness endpoint ──────────────────────────────────────────
@app.get("/health")
def health_check():
    """
    Returns comprehensive system health status.
    Checks MongoDB connectivity, collection stats, indexes, and FAISS status.
    Used by uptime monitors and load balancers.
    Returns 200 if healthy, 503 if DB is down.
    """
    from datetime import datetime
    from fastapi.responses import JSONResponse

    status = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "version": "2.0.0",
        "service": "Vidhan.ai Backend",
    }

    # ── MongoDB connectivity ─────────────────────────────────────────────
    mongo_ok = False
    try:
        from app.db.connection import (
            client, DB_NAME, MONGO_URI,
            bns_collection, ipc_collection,
            queries_collection, users_collection,
        )
        # Ping
        client.admin.command("ping")
        mongo_ok = True

        # Server info (version)
        try:
            server_info = client.server_info()
            mongo_version = server_info.get("version", "unknown")
        except Exception:
            mongo_version = "unknown"

        # Mask URI for security (show host only)
        import re as _re
        masked_uri = _re.sub(r"://[^@]+@", "://***@", MONGO_URI)

        # Collection document counts
        bns_count = bns_collection.count_documents({})
        ipc_count = ipc_collection.count_documents({})
        queries_count = queries_collection.count_documents({})
        users_count = users_collection.count_documents({})

        status["mongodb"] = {
            "status": "connected",
            "server_version": mongo_version,
            "database": DB_NAME,
            "uri": masked_uri,
            "collections": {
                "bns_sections": {"count": bns_count, "status": "ok" if bns_count > 0 else "empty"},
                "ipc_sections": {"count": ipc_count, "status": "ok" if ipc_count > 0 else "empty"},
                "queries": {"count": queries_count},
                "users": {"count": users_count},
            },
            "total_law_documents": bns_count + ipc_count,
        }
    except Exception as e:
        status["mongodb"] = {
            "status": "disconnected",
            "error": str(e)[:120],
        }

    # ── FAISS vector index status ─────────────────────────────────────────
    try:
        from vector.search import _lazy_init, _index, _ids, INDEX_PATH
        import os

        faiss_ready = _lazy_init()
        if faiss_ready and _index is not None:
            # Determine source breakdown
            bns_vectors = 0
            ipc_vectors = 0
            if _ids:
                for entry in _ids:
                    if isinstance(entry, dict) and entry.get("source") == "ipc":
                        ipc_vectors += 1
                    else:
                        bns_vectors += 1

            status["faiss"] = {
                "status": "ready",
                "total_vectors": _index.ntotal,
                "dimension": _index.d,
                "bns_vectors": bns_vectors,
                "ipc_vectors": ipc_vectors,
                "index_file": os.path.basename(INDEX_PATH),
            }
        else:
            status["faiss"] = {"status": "unavailable", "reason": "Index not loaded or missing"}
    except Exception as e:
        status["faiss"] = {"status": "error", "error": str(e)[:80]}

    # ── Overall health verdict ───────────────────────────────────────────
    faiss_ok = status.get("faiss", {}).get("status") == "ready"
    total_laws = status.get("mongodb", {}).get("total_law_documents", 0)

    if mongo_ok and faiss_ok and total_laws > 0:
        status["status"] = "healthy"
        status["message"] = "All systems operational"
    elif mongo_ok and total_laws > 0:
        status["status"] = "degraded"
        status["message"] = "MongoDB OK but FAISS vector search unavailable — keyword fallback active"
    elif mongo_ok:
        status["status"] = "degraded"
        status["message"] = "MongoDB connected but law collections are empty — run seed scripts"
    else:
        status["status"] = "unhealthy"
        status["message"] = "MongoDB unreachable — database-dependent endpoints will fail"

    is_healthy = status["status"] != "unhealthy"

    return JSONResponse(
        content=status,
        status_code=200 if is_healthy else 503,
    )