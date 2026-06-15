"""
AI service — dual-provider wrapper with strict separation:

  Gemini (GEMINI_API_KEY):
    - Chat RAG answers (/ask, /ask-stream)
    - Comic story generation (/comic-story, /ask mode=comic)
    - Translation, simplify, voice intent
    - Quiz, detective, scenario generation

  Groq (GROQ_API_KEY):
    - IPC↔BNS comparison ONLY (/ai-compare via generate_groq_json_response)
    - Resilience fallback for chat (/ask, /ask-stream) if Gemini is
      rate-limited or unavailable, so the assistant keeps responding.

Never use Gemini for /ai-compare.
"""
import os
import time
import logging

import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

_PRIMARY_MODEL  = "gemini-2.5-flash"
_FALLBACK_MODEL = "gemini-2.5-flash"

_RATE_LIMIT_MSG = (
    "⏳ The AI assistant is currently handling many requests. "
    "Please wait 30 seconds and try again."
)
_UNAVAILABLE_MSG = (
    "⚠️ AI is temporarily unavailable. Please try again in a moment. "
    "Your question has been noted and our legal database is still accessible."
)

def _convert_messages_for_gemini(messages: list):
    system_instruction = None
    if messages and messages[0].get("role") == "system":
        system_instruction = messages[0]["content"]
        messages = messages[1:]
    
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [msg["content"]]})
        
    return system_instruction, contents

def _call_gemini(model_name: str, messages: list, temperature: float, max_tokens: int, response_mime_type: str = "text/plain") -> str:
    system_instruction, contents = _convert_messages_for_gemini(messages)
    
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_instruction
    )
    
    config = GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        response_mime_type=response_mime_type
    )

    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    
    for attempt in range(3):
        try:
            response = model.generate_content(contents, generation_config=config, safety_settings=safety_settings)
            return response.text
        except Exception as e:
            logger.error(f"[AI] Gemini error (attempt {attempt+1}): {e}")
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
            else:
                raise e


_SYSTEM_PROMPT = """You are Vidhan.ai — an Indian Legal AI assistant specializing in BNS 2023 (Bharatiya Nyaya Sanhita) and IPC 1860.

CRITICAL RULES:
1. Provide COMPREHENSIVE and EDUCATIONAL answers. Always cover: (a) what the law says in plain words, (b) the exact BNS section number, (c) the punishment or legal consequence, (d) a brief real-life example or scenario to make it relatable. Write clearly so a student or ordinary person can fully understand. The user can always click "Explain Simply" for a shorter version — your default job is to give a THOROUGH answer.
2. DO NOT use conversational preambles or greetings (e.g., NEVER say "Hello!", "As Vidhan.ai I am here to help", or "Please feel free to ask"). Go straight to the answer.
3. Answer ALL questions related to Indian law, legal rights, police procedures, FIR filing, bail, courts, constitutional rights, criminal law, civil law, family law, cyber law, property law, consumer rights, labour law, or any topic that involves the Indian legal system — even if the database context does not fully cover it, use your legal knowledge to help. ONLY refuse and reply EXACTLY with "I am an AI legal assistant. I can only answer questions related to Indian Law. Please ask a legal question." when the user asks about completely unrelated topics such as movies, cricket, sports, cooking, entertainment, personal finance advice, or casual small talk with zero legal relevance.
4. BNS 2023 is the CURRENT ACTIVE LAW in India — always cite BNS first. IPC 1860 is the OLD/HISTORICAL LAW. Mention both section numbers when relevant (e.g., "BNS 103 (previously IPC 302)").
5. NO markdown headers like '##', NO "---" dividers.
6. Always end with a practical note: what someone should do in this situation (e.g., "file an FIR", "consult a lawyer", "apply for bail").

RESPONSE FORMAT:
Start with a 1-2 sentence direct answer to the question, then give the full explanation.
If listing rights or distinct points, format each point like this:
⚖️ 1. **Right to [Topic]**
Full explanation of the right with context and example...

Ensure that the number, icon, and title of list items are enclosed in markdown bold (**).
"""


def _build_user_prompt(question: str, context: str, language: str) -> str:
    lang_instruction = (
        f"\n\nIMPORTANT: Respond ENTIRELY in {language} language."
        if language and language.lower() != "english"
        else ""
    )
    return (
        f"Legal Context (from Indian Law Database — BNS 2023 Primary):\n"
        f"{context}\n\n"
        f"User Question:\n{question}"
        f"{lang_instruction}\n\n"
        f"Detailed Answer:"
    )


def generate_ai_response(question: str, context: str, language: str = "English") -> str:
    if not context:
        return "I couldn't find specific legal information for this question. Please try rephrasing or ask about a specific IPC/BNS section."

    user_prompt = _build_user_prompt(question, context, language)

    try:
        return _call_gemini(
            model_name=_PRIMARY_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
    except Exception as e:
        logger.error(f"[AI] generate_ai_response failed: {e}")
        # Gemini quota/outage — fall back to Groq so chat keeps working
        fallback = generate_groq_text(_SYSTEM_PROMPT, user_prompt, temperature=0.3, max_tokens=2048)
        return fallback or _UNAVAILABLE_MSG


def generate_translation(text: str, target_language: str, context: str = "") -> str:
    ctx_hint = "This is a legal text about Indian law (IPC/BNS).\n" if context else ""
    prompt = f"""You are a professional legal translator.

{ctx_hint}Translate the following text accurately to {target_language}.
Keep legal terms, section numbers (IPC, BNS), and names unchanged.
Only output the translated text, nothing else.

Text to translate:
{text}

Translation in {target_language}:"""

    try:
        return _call_gemini(
            model_name=_PRIMARY_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=600,
        )
    except Exception as e:
        logger.error(f"[AI] Translation failed: {e}")
        return text


def _call_gemini_stream(model_name: str, messages: list, temperature: float, max_tokens: int):
    system_instruction, contents = _convert_messages_for_gemini(messages)
    
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_instruction
    )
    
    config = GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_tokens
    )

    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]
    
    try:
        response = model.generate_content(contents, generation_config=config, stream=True, safety_settings=safety_settings)
        for chunk in response:
            try:
                if chunk.text:
                    yield chunk.text
            except ValueError:
                # Catch when chunk.text throws ValueError due to safety filters
                yield "\n\n[Warning: Output partially filtered by safety constraints]"
    except Exception as e:
        logger.error(f"[AI] Stream API error: {e}")
        raise e


def generate_ai_response_stream(question: str, context: str, language: str = "English"):
    if not context:
        yield "I couldn't find specific legal information for this question. Please try rephrasing or ask about a specific IPC/BNS section."
        return

    user_prompt = _build_user_prompt(question, context, language)

    try:
        yield from _call_gemini_stream(
            model_name=_PRIMARY_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=2048,
        )
    except Exception as e:
        logger.error(f"[AI] generate_ai_response_stream failed: {e}")
        # Gemini quota/outage — fall back to Groq so chat keeps working
        fallback = generate_groq_text(_SYSTEM_PROMPT, user_prompt, temperature=0.3, max_tokens=2048)
        yield fallback or _UNAVAILABLE_MSG


def generate_json_response(system_prompt: str, user_prompt: str, temperature: float = 0.3, max_tokens: int = 2000) -> str:
    """Helper to generate structured JSON format from Gemini"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    return _call_gemini(
        model_name=_PRIMARY_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        response_mime_type="application/json"
    )

from groq import Groq

GROQ_MODEL             = "llama-3.3-70b-versatile"
GROQ_COMPARISON_MODEL  = GROQ_MODEL  # alias kept for /ai-compare

# ── JD system prompt (full specification) ────────────────────────────────────
_JD_SYSTEM_PROMPT = """You are JD, the official AI Voice Assistant and AI Law Tutor of Vidhan AI.
You are powered by Groq and connected to a legal RAG system containing BNS 2023, IPC 1860, legal chapters, sections, definitions, explanations, examples, and comparisons.

Your job is NOT to repeat legal text. Your responsibility is to help users understand law in a simple, interactive, human-like manner.

You have THREE MODES. Automatically determine the correct mode based on the user's request.

────────────────────────────────────────────
MODE 1: WEBSITE ASSISTANT
────────────────────────────────────────────
When the user gives navigation commands like "Open Tutor", "Start Quiz", "Go Home", "Open Chatbot", "Show Dashboard", "Open Compare", "Open Comics", "Open Profile", return ONLY the action on its own line:

ACTION: OPEN_TUTOR
ACTION: OPEN_CHATBOT
ACTION: OPEN_COMPARISON
ACTION: OPEN_DASHBOARD
ACTION: OPEN_PROFILE
ACTION: OPEN_COMICS
ACTION: START_QUIZ
ACTION: OPEN_HOME
ACTION: OPEN_DETECTIVE

Recognize natural language variations. "Take me to the tutor", "Launch learning", "Open learning mode" all → ACTION: OPEN_TUTOR

────────────────────────────────────────────
MODE 2: LEGAL ASSISTANT
────────────────────────────────────────────
When users ask legal questions (what is murder, explain Section 103, punishment for theft, etc.):

Use the RAG context provided as your primary source. Never hallucinate legal content.

Structure every explanation as:
1. Simple meaning (1 sentence)
2. Why this law exists
3. Key concepts
4. Real-life Indian example with named characters
5. Punishment (if applicable)
6. Practical note: what to do (file FIR, consult lawyer, etc.)

Always cite BNS first (current law), mention IPC as historical reference. Example: "BNS 103 (previously IPC 302)".

────────────────────────────────────────────
MODE 3: AI LAW TUTOR
────────────────────────────────────────────
When users ask to learn, explain a chapter, teach a concept, or continue a lesson:

Teach like a real teacher — concept-first, never dump legal text.

Teaching sequence:
Concept → Simple Explanation → Real-Life Indian Example → Question to user → Wait for answer → Give Feedback → Next Concept

After every concept, ask one question. Examples:
"What is the most important element in this offence?"
"Would this be considered murder or an accident?"

After 3-4 concepts, give a quick MCQ or True/False.

If the user answers wrong: simplify, give another example, ask an easier question.

────────────────────────────────────────────
VOICE OUTPUT RULES (ALWAYS APPLY)
────────────────────────────────────────────
Your responses will be read aloud by SpeechSynthesis. Therefore:
- Short sentences. Maximum 2-3 sentences per paragraph.
- No markdown headers (##, ---).
- No bullet point symbols (*, -, •). Use numbered lists or plain prose.
- Sound like a teacher speaking, not a document.
- Pause naturally between concepts.
- Keep total response under 120 words for legal answers, under 80 words for tutor turns.

NEVER use: "As an AI...", "I am JD and I will...", preambles, greetings per message.
Go straight to the answer.
"""


def generate_jd_response(
    message: str,
    rag_context: str = "",
    history: list = None,
    language: str = "English",
    context_section: str = "",
) -> dict:
    """
    Generate a JD response via Groq. Returns:
    {
        "response": str,          # spoken reply
        "action":   str | None,   # e.g. "OPEN_TUTOR" if navigation
        "mode":     str,          # "website_assistant" | "legal" | "tutor"
        "rag_used": bool
    }
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("[JD] GROQ_API_KEY not set")
        return {"response": "I'm temporarily unavailable. Please try again.", "action": None, "mode": "error", "rag_used": False}

    # Build message list for Groq
    msgs = [{"role": "system", "content": _JD_SYSTEM_PROMPT}]

    # Add conversation history (last 3 turns = 6 messages max)
    for role, text in (history or [])[-6:]:
        groq_role = "user" if role == "user" else "assistant"
        msgs.append({"role": groq_role, "content": text})

    # Build user content — include RAG context and section context if available
    user_parts = []
    if context_section:
        user_parts.append(f"[Current lesson section: {context_section}]")
    if rag_context:
        user_parts.append(f"[Legal RAG Context]\n{rag_context}\n[End RAG Context]")
    if language and language.lower() != "english":
        user_parts.append(f"[Respond entirely in {language}]")
    user_parts.append(message)

    msgs.append({"role": "user", "content": "\n\n".join(user_parts)})

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=msgs,
            temperature=0.5,
            max_tokens=300,
        )
        raw = (completion.choices[0].message.content or "").strip()

        # Detect ACTION response (Mode 1 navigation)
        action = None
        mode   = "legal"
        if raw.startswith("ACTION:"):
            action_code = raw.split("ACTION:")[-1].strip().split()[0]
            action = action_code
            mode   = "website_assistant"
            # Friendly spoken confirmation
            nav_replies = {
                "OPEN_TUTOR":      "Opening the Law Tutor.",
                "OPEN_CHATBOT":    "Opening the AI Legal Chat.",
                "OPEN_COMPARISON": "Opening Law Comparison.",
                "OPEN_DASHBOARD":  "Opening your Dashboard.",
                "OPEN_PROFILE":    "Opening your Profile.",
                "OPEN_COMICS":     "Opening Legal Comics.",
                "START_QUIZ":      "Starting the Quiz. Good luck!",
                "OPEN_HOME":       "Going to the home page.",
                "OPEN_DETECTIVE":  "Starting the Detective Game!",
            }
            raw = nav_replies.get(action_code, f"Opening {action_code.replace('_', ' ').title()}.")

        elif any(kw in message.lower() for kw in ["teach", "learn", "explain chapter", "next concept", "continue lesson", "tutor"]):
            mode = "tutor"

        return {"response": raw, "action": action, "mode": mode, "rag_used": bool(rag_context)}

    except Exception as e:
        logger.error(f"[JD] Groq generate_jd_response failed: {e}")
        return {
            "response": "I'm having trouble right now. Please try again in a moment.",
            "action": None,
            "mode": "error",
            "rag_used": False,
        }


def generate_groq_text(system_prompt: str, user_prompt: str, temperature: float = 0.4, max_tokens: int = 600) -> str:
    """Generate a plain-text answer via Groq (fast). Returns '' on failure."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("[AI] GROQ_API_KEY not set — generate_groq_text unavailable")
        return ""
    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return (completion.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("[AI] generate_groq_text failed: %s", e)
        return ""


def generate_groq_json_response(system_prompt: str, user_prompt: str, temperature: float = 0.2, max_tokens: int = 2000) -> str:
    """Generate structured JSON via Groq — for /ai-compare law comparison."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.error("[AI] GROQ_API_KEY not set — comparison unavailable")
        return "{}"
    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=GROQ_COMPARISON_MODEL,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        logger.error(f"[AI] Groq comparison JSON failed: {e}")
        return "{}"
