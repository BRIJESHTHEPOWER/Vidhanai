"""
History router — /ask (RAG chat), /history, /bookmark/:id, /export-pdf/:id
"""
import io
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.utils import simpleSplit
    _REPORTLAB_AVAILABLE = True
except ImportError:
    _REPORTLAB_AVAILABLE = False

from app.db.connection import queries_collection, bns_collection
from app.routers import get_current_user_email_optional, rag_context_from_db, sanitize_input
from app.services.rag import find_relevant_law
from app.services.ai import generate_ai_response
from app.services.story import generate_story

router = APIRouter(tags=["History & Chat"])


class Question(BaseModel):
    question: str
    mode:     Optional[str] = "both"
    language: Optional[str] = "English"


# ── Main ASK endpoint (RAG) — rate limited: 20/min per IP ────────────────────
@router.post("/ask")
@limiter.limit("20/minute")
def ask_question(
    request:    Request,
    data:       Question,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    # H6: sanitize + validate input
    question = sanitize_input(data.question, max_len=2000)
    mode     = data.mode
    language = data.language

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Context: try FAISS first, then keyword fallback
    try:
        context = find_relevant_law(question)
    except Exception as e:
        print(f"[WARN] FAISS search failed: {e}")
        context = None
        
    if not context:
        try:
            context = rag_context_from_db(question)
        except Exception as e:
            print(f"[WARN] RAG keyword fallback failed: {e}")
            context = None

    if not context:
        return {
            "question": question,
            "answer":   "This question is not related to Indian law. Please ask about IPC or BNS sections." if mode in ["rag", "both"] else None,
            "story":    [] if mode in ["comic", "both"] else None,
        }

    answer = None
    story  = None

    if mode in ["rag", "both"]:
        try:
            answer = generate_ai_response(question, context, language)
        except Exception as e:
            print(f"[WARN] AI response failed: {e}")
            answer = "AI is temporarily unavailable. Please try again."

    if mode in ["comic", "both"]:
        try:
            story = generate_story(context, question, language)
        except Exception as e:
            print(f"[WARN] Story generation failed: {e}")
            story = []

    # L2: extract law IDs from context instead of storing full text
    law_ids = []
    try:
        import re as _re
        # Find IPC section numbers referenced in context
        found = _re.findall(r'IPC Section (\S+)', context or "")
        law_ids = list(set(found))
    except Exception:
        pass

    doc_id = None
    try:
        result = queries_collection.insert_one({
            "email":      user_email,
            "question":   question,
            "mode":       mode,
            "law_ids":    law_ids,   # L2: store refs, not full text
            "answer":     answer,
            "story":      story,
            "language":   language,
            "bookmarked": False,
            "created_at": datetime.utcnow(),
        })
        doc_id = str(result.inserted_id)
    except Exception as e:
        print("MongoDB Save Error:", e)

    return {
        "id":       doc_id,
        "question": question,
        "context":  context,
        "answer":   answer,
        "story":    story,
        "language": language,
    }


# ── Chat history ──────────────────────────────────────────────────────────────
@router.get("/history")
@limiter.limit("30/minute")
def get_history(request: Request, user_email: Optional[str] = Depends(get_current_user_email_optional)):
    if not user_email:
        return []
    try:
        cursor  = queries_collection.find({"email": user_email}).sort("created_at", -1)
        results = []
        for doc in cursor:
            results.append({
                "id":         str(doc["_id"]),
                "question":   doc.get("question"),
                "answer":     doc.get("answer"),
                "story":      doc.get("story", []),
                "mode":       doc.get("mode"),
                "language":   doc.get("language", "English"),
                "bookmarked": doc.get("bookmarked", False),
                "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
            })
        return results
    except Exception as e:
        print("History Fetch Error:", e)
        return []


# ── Toggle bookmark ───────────────────────────────────────────────────────────
@router.put("/bookmark/{history_id}")
@limiter.limit("30/minute")
def toggle_bookmark(
    request: Request,
    history_id: str,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    if not user_email:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        query = {"_id": ObjectId(history_id), "email": user_email}
        doc   = queries_collection.find_one(query)
        if not doc:
            raise HTTPException(status_code=404, detail="Query not found")
        new_val = not doc.get("bookmarked", False)
        queries_collection.update_one(query, {"$set": {"bookmarked": new_val}})
        return {"id": history_id, "bookmarked": new_val}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[WARN] Toggle bookmark failed: {e}")
        raise HTTPException(status_code=500, detail="Error toggling bookmark")


# ── PDF export ────────────────────────────────────────────────────────────────
@router.get("/export-pdf/{history_id}")
@limiter.limit("10/minute")
def export_pdf(request: Request, history_id: str):
    if not _REPORTLAB_AVAILABLE:
        raise HTTPException(
            status_code=501,
            detail="PDF export unavailable — install reportlab: pip install reportlab"
        )
    try:
        doc = queries_collection.find_one({"_id": ObjectId(history_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Query not found")

        buffer = io.BytesIO()
        p      = canvas.Canvas(buffer, pagesize=letter)
        p.setFont("Helvetica-Bold", 16)
        y_position = 750

        def draw_text(text, fontsize=12, bold=False):
            nonlocal y_position
            font = "Helvetica-Bold" if bold else "Helvetica"
            if y_position < 50:
                p.showPage()
                y_position = 750
            p.setFont(font, fontsize)
            lines = simpleSplit(text or "", font, fontsize, 500)
            for line in lines:
                if y_position < 50:
                    p.showPage()
                    p.setFont(font, fontsize)
                    y_position = 750
                p.drawString(50, y_position, line)
                y_position -= (fontsize + 5)
            y_position -= 10

        draw_text("Vidhan.ai Legal Report", 20, True)
        y_position -= 20
        draw_text("Query:", 14, True)
        draw_text(doc.get("question", "N/A"))
        draw_text("AI Analysis:", 14, True)
        # M4: use latin-1 with replace — makes non-latin chars visible as '?'
        # instead of silently dropping them with ascii/ignore
        ans = str(doc.get("answer", "")).encode("latin-1", "replace").decode("latin-1")
        draw_text(ans)

        if doc.get("story"):
            draw_text("Visual Story Scenes:", 14, True)
            for s in doc.get("story", []):
                scene_text = f"{s.get('scene', '')}: {s.get('text', '')}"
                draw_text(
                    scene_text.encode("latin-1", "replace").decode("latin-1"),
                    10,
                )

        p.save()
        buffer.seek(0)
        headers = {"Content-Disposition": f'attachment; filename="Vidhan.ai_Report_{history_id}.pdf"'}
        return StreamingResponse(buffer, media_type="application/pdf", headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        print("PDF Gen Error:", e)
        raise HTTPException(status_code=500, detail="Failed to generate PDF")
