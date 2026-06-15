"""
Voice router — /translate, /voice/ask
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import queries_collection
from app.routers import get_current_user_email_optional, rag_context_from_db, sanitize_input
from app.services.rag import find_relevant_law
from app.services.ai import generate_ai_response, generate_translation
from app.services.story import generate_story

router = APIRouter(tags=["Voice & Translation"])
limiter = Limiter(key_func=get_remote_address)


class TranslateRequest(BaseModel):
    text:            str
    target_language: str
    context:         Optional[str] = ""


class VoiceAskRequest(BaseModel):
    transcript: str
    language:   Optional[str] = "English"


# ── Translation ───────────────────────────────────────────────────────────────
@router.post("/translate")
@limiter.limit("30/minute")
def translate_text(request: Request, body: TranslateRequest):
    """
    Translate arbitrary text to the target language using Gemini.
    Supports: English, Hindi, Kannada, Tamil, Telugu, Marathi, Bengali.
    """
    if not body.text or not body.text.strip():
        return {"translated": "", "language": body.target_language}

    if body.target_language.lower() == "english":
        return {"translated": body.text, "language": "English"}

    try:
        translated = generate_translation(body.text, body.target_language, body.context)
        return {"translated": translated, "language": body.target_language}
    except Exception as e:
        print("Translation Error:", e)
        return {"translated": body.text, "language": body.target_language, "error": str(e)}


# ── Voice ask ─────────────────────────────────────────────────────────────────
@router.post("/voice/ask")
@limiter.limit("20/minute")
def voice_ask(
    request:    Request,
    data:       VoiceAskRequest,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    """Process a voice transcript through RAG and return answer + story."""
    question = sanitize_input(data.transcript.strip(), max_len=1500)
    if not question:
        return {"error": "Empty transcript"}

    try:
        context = rag_context_from_db(question)
    except Exception as e:
        print(f"[WARN] rag_context_from_db failed: {e}")
        context = None
        
    if not context:
        try:
            context = find_relevant_law(question)
        except Exception as e:
            print(f"[WARN] find_relevant_law failed: {e}")
            context = None

    if not context:
        return {
            "answer": "Sorry, I couldn't find relevant Indian law for that question.",
            "story":  [],
        }

    try:
        answer = generate_ai_response(question, context, data.language)
    except Exception as e:
        print(f"[WARN] generate_ai_response failed: {e}")
        answer = "AI is temporarily unavailable. Please try again."
        
    try:
        story = generate_story(context, question, data.language)
    except Exception as e:
        print(f"[WARN] generate_story failed: {e}")
        story = []

    try:
        queries_collection.insert_one({
            "email":      user_email,
            "question":   question,
            "mode":       "voice",
            "context":    context,
            "answer":     answer,
            "story":      story,
            "language":   data.language,
            "bookmarked": False,
            "created_at": datetime.utcnow(),
        })
    except Exception as e:
        print(f"[WARN] DB insert failed: {e}")

    return {"answer": answer, "story": story, "language": data.language}


class VoiceIntentRequest(BaseModel):
    transcript: str
    current_section: Optional[str] = None


@router.post("/voice/intent")
@limiter.limit("30/minute")
def voice_intent(request: Request, body: VoiceIntentRequest):
    """
    Classify the voice transcript to find intent, parameter and a spoken response.
    """
    transcript = sanitize_input(body.transcript.strip(), max_len=500)
    current_section = body.current_section

    if not transcript:
        return {"intent": "default", "parameter": None, "response": "I didn't catch that."}

    try:
        from app.services.ai import generate_json_response
        import json

        system_prompt = (
            "You are the Voice Intent Engine for Vidhan.ai (Indian legal app).\n"
            "Analyze the transcript and current_section, and classify it into one of these intents:\n"
            "- open_home, open_chatbot, open_detective, open_quiz, open_comic, open_comparison, go_back\n"
            "- explain_law, search_section, read_punishment, legal_example, summarize_section, related_sections (parameter: section number/name, default to current_section if applicable)\n"
            "- compare_sections (parameter: sections like '378,303')\n"
            "- generate_comic (parameter: topic or section)\n"
            "- start_detective, inspect_scene, inspect_clue (parameter: clue name), show_evidence, interrogate_suspect (parameter: suspect name), accuse_suspect (parameter: suspect name), reveal_hint\n"
            "- start_quiz, next_question, submit_answer (parameter: answer like 'A' or 'B'), show_score\n"
            "- stop_speaking\n"
            "- default (fallback to general QA search)\n\n"
            "Return ONLY valid JSON like: {\"intent\": \"...\", \"parameter\": \"...\" or null, \"response\": \"...\"}.\n"
            "Keep the response field short and natural (1 sentence spoken reply)."
        )

        user_prompt = f"Current Section Context: {current_section or 'None'}\nTranscript: \"{transcript}\"\nJSON output:"

        result_str = generate_json_response(system_prompt, user_prompt, temperature=0.0, max_tokens=150)

        result = json.loads(result_str)
        return {
            "intent": result.get("intent", "default"),
            "parameter": result.get("parameter"),
            "response": result.get("response", "Okay.")
        }
    except Exception as e:
        print("Voice Intent Parsing Error:", e)
        # Simple rule-based fallback
        lower_trans = transcript.lower()
        if "detective" in lower_trans or "game" in lower_trans or "case" in lower_trans:
            return {"intent": "open_detective", "parameter": None, "response": "Opening the detective game."}
        if "quiz" in lower_trans or "test" in lower_trans:
            return {"intent": "open_quiz", "parameter": None, "response": "Starting the quiz."}
        if "comic" in lower_trans or "story" in lower_trans:
            return {"intent": "open_comic", "parameter": None, "response": "Opening the comic story generator."}
        if "compare" in lower_trans:
            return {"intent": "open_comparison", "parameter": None, "response": "Opening the comparison tool."}
        if "home" in lower_trans or "dashboard" in lower_trans:
            return {"intent": "open_home", "parameter": None, "response": "Going to the homepage."}
        
        return {
            "intent": "default",
            "parameter": None,
            "response": f"Searching for {transcript}."
        }

