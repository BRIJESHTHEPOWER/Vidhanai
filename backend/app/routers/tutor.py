"""
Tutor router — AI-powered Law Tutor for BNS 2023 and IPC 1860.
Teaches chapter-by-chapter with JD AI, mid-lesson checkpoints,
chapter assessments, and performance analysis.
"""
import re
import json
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from concurrent.futures import ThreadPoolExecutor

from app.db.connection import bns_collection, ipc_collection
from app.services.ai import generate_groq_json_response, generate_groq_text, generate_json_response
from app.services.teaching import generate_doubt_answer, generate_teaching_script, generate_chapter_intro
from app.services import sarvam_llm


def _is_indian(language: str) -> bool:
    return bool(language) and (language or "").strip().lower() != "english"


def _parse_json_object(raw: str) -> dict | None:
    """Best-effort parse of a JSON object from a model's raw text output.
    Handles markdown fences and trailing/leading junk."""
    if not raw:
        return None
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None


def _groq_lesson_json(system: str, user_text: str, max_tokens: int = 1800) -> dict | None:
    """Generate lesson JSON via Groq (plain-text mode, manual parse)."""
    return _parse_json_object(generate_groq_text(system, user_text, temperature=0.45, max_tokens=max_tokens))


# South Indian scripts (Tamil/Kannada/Telugu/Malayalam) use 3-4× more tokens per
# character than Latin/Devanagari, so the full lesson JSON needs a generous output
# budget or Gemini truncates it mid-object → invalid JSON. Malayalam is the most
# token-dense, so we keep plenty of headroom (this is a cap, not a fixed cost).
_GEMINI_JSON_TOKENS = 7000


def _gemini_lesson_json(system: str, user_text: str, max_tokens: int = _GEMINI_JSON_TOKENS) -> dict | None:
    """Generate lesson JSON via Gemini (application/json mode). Used as a
    fallback when Sarvam is unavailable — also strong at Indian-language JSON."""
    try:
        return _parse_json_object(generate_json_response(system, user_text, temperature=0.45, max_tokens=max_tokens))
    except Exception as exc:
        logger.warning("[Tutor] Gemini lesson JSON failed: %s", exc)
        return None


def _sarvam_lesson_json(system: str, user_text: str, max_tokens: int = 4200) -> dict | None:
    """Generate lesson JSON via Sarvam-105b — Sarvam's own LLM, purpose-built
    for Indian languages, so it writes correct native script inside valid JSON
    for Tamil/Kannada/Telugu/Malayalam/Marathi/Hindi as well as English."""
    try:
        return _parse_json_object(sarvam_llm.generate_text(system, user_text, temperature=0.45, max_tokens=max_tokens))
    except Exception as exc:
        logger.warning("[Tutor] Sarvam lesson JSON failed: %s", exc)
        return None


def _lesson_display_json(system: str, user_text: str, language: str, max_tokens: int = 1800) -> dict | None:
    """Generate the on-screen lesson JSON, routed by language:
      • Indian languages → Sarvam AI (Sarvam-105b): native-script quality
                           (slower, but correct where Llama fails). Gemini is
                           the automatic fallback.
      • English          → Groq (Llama): fast. Gemini is the fallback.
    Groq is intentionally NOT used for Indian languages — it silently reverts
    South Indian scripts (Tamil/Kannada/Telugu/Malayalam) to English."""
    def _usable(d):
        return isinstance(d, dict) and bool(d.get("plain_explanation"))

    if _is_indian(language):
        data = _sarvam_lesson_json(system, user_text)
        if _usable(data):
            return data
        logger.warning("[Tutor] Sarvam JSON unusable for %s — falling back to Gemini", language)
        return _gemini_lesson_json(system, user_text)

    # English → Groq (fast); Gemini fallback.
    data = _groq_lesson_json(system, user_text, max_tokens)
    if _usable(data):
        return data
    return _gemini_lesson_json(system, user_text)

logger = logging.getLogger(__name__)

from app.services.plan_gate import require_pro

# The AI Law Tutor is a Pro-plan feature — every endpoint requires Pro.
router = APIRouter(tags=["Tutor"], dependencies=[Depends(require_pro)])
limiter = Limiter(key_func=get_remote_address)

# ── Chapter badges ─────────────────────────────────────────────────────────────
CHAPTER_BADGES = [
    {"icon": "📜", "name": "Law Initiate",         "color": "#6366f1"},
    {"icon": "⚖️", "name": "Justice Explorer",      "color": "#3b82f6"},
    {"icon": "🛡️", "name": "Defense Scholar",       "color": "#06b6d4"},
    {"icon": "🔗", "name": "Conspiracy Expert",     "color": "#8b5cf6"},
    {"icon": "🏛️", "name": "State Guardian",        "color": "#f59e0b"},
    {"icon": "🎖️", "name": "Force Defender",        "color": "#ef4444"},
    {"icon": "🗳️", "name": "Democracy Champion",    "color": "#22c55e"},
    {"icon": "🕊️", "name": "Peacekeeper",           "color": "#14b8a6"},
    {"icon": "👮", "name": "Integrity Champion",    "color": "#f97316"},
    {"icon": "📋", "name": "Order Enforcer",        "color": "#a78bfa"},
    {"icon": "🔍", "name": "Evidence Master",       "color": "#34d399"},
    {"icon": "💰", "name": "Finance Guardian",      "color": "#fbbf24"},
    {"icon": "📏", "name": "Fair Trade Scholar",    "color": "#60a5fa"},
    {"icon": "🏥", "name": "Safety Advocate",       "color": "#4ade80"},
    {"icon": "🕌", "name": "Harmony Keeper",        "color": "#fb923c"},
    {"icon": "💪", "name": "Rights Defender",       "color": "#c084fc"},
    {"icon": "👨‍👩‍👧", "name": "Protection Expert",     "color": "#f472b6"},
    {"icon": "🏠", "name": "Property Law Expert",   "color": "#818cf8"},
    {"icon": "🔐", "name": "Trust Guardian",        "color": "#2dd4bf"},
    {"icon": "🎯", "name": "Grand Scholar",         "color": "#fcd34d"},
]

SPECIAL_BADGES = {
    "chapter_master":    {"icon": "🏅", "name": "Chapter Master",   "color": "#f59e0b", "desc": "Pass any chapter"},
    "chapter_expert":    {"icon": "🥇", "name": "Chapter Expert",   "color": "#fbbf24", "desc": "Score 90%+"},
    "perfect_scholar":   {"icon": "👑", "name": "Perfect Scholar",   "color": "#f97316", "desc": "Score 100%"},
    "bns_master":        {"icon": "⚖️", "name": "BNS Master",        "color": "#6366f1", "desc": "Complete BNS course"},
    "ipc_legend":        {"icon": "⚔️", "name": "IPC Legend",        "color": "#ef4444", "desc": "Complete IPC course"},
    "grand_jurist":      {"icon": "🏆", "name": "Grand Jurist",      "color": "#22d3ee", "desc": "Complete both courses"},
}

# ── Shared helpers ─────────────────────────────────────────────────────────────

def _pun_to_str(p) -> str:
    if isinstance(p, dict):
        parts = []
        if p.get("maximum_imprisonment"): parts.append(p["maximum_imprisonment"])
        if p.get("minimum_imprisonment"): parts.append(f"minimum {p['minimum_imprisonment']}")
        if p.get("fine"): parts.append(f"fine {p['fine']}")
        return " and ".join(parts) if parts else ""
    return (p or "").strip()


def _section_sort_key(s: dict):
    """Natural sort for section numbers so they appear in real legislative order.
    Splits into (numeric, letter-suffix): 12 → (12,''), 108A → (108,'A'),
    120A → (120,'A'), 120B → (120,'B'). Without this, string sort scrambles them
    (e.g. '12' after '108A', '10' before '2')."""
    num = str(s.get("section_number", "")).strip()
    m = re.match(r"^(\d+)\s*([A-Za-z]*)", num)
    if m:
        return (int(m.group(1)), m.group(2).upper())
    return (10**9, num)   # non-standard numbers sink to the end, stable


_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def _roman_to_int(r: str) -> int:
    total, prev = 0, 0
    for ch in reversed(r.upper()):
        v = _ROMAN.get(ch, 0)
        total += -v if v < prev else v
        prev = v
    return total


def _chapter_sort_key(chapter_name: str):
    """Order chapters by their real numeral: 'Chapter IV - …' → (4, 0),
    'Chapter VA - …' → (5, 1) (a sub-chapter after V). Chapters without a
    recognisable numeral sort to the end alphabetically."""
    m = re.match(r"\s*chapter\s+([IVXLCDM]+)([A-Za-z]*)\b", chapter_name.strip(), re.IGNORECASE)
    if m:
        base = _roman_to_int(m.group(1))
        suffix = m.group(2).upper()
        sub = (ord(suffix[0]) - ord("A") + 1) if suffix else 0
        return (0, base, sub, chapter_name.lower())
    return (1, 10**9, 0, chapter_name.lower())


def _fetch_bns_chapters():
    docs = list(bns_collection.find({}, {"_id": 0, "section_number": 1, "chapter": 1,
                                          "title": 1, "description": 1, "ai_summary": 1,
                                          "punishment": 1, "is_punishable": 1, "important_definitions": 1}))
    chapters = {}
    for d in docs:
        ch = (d.get("chapter") or "General").strip()
        if ch not in chapters:
            chapters[ch] = []
        chapters[ch].append(d)

    # Chapters in real legislative order (Chapter I, II, … XX), sections in
    # real numeric order within each chapter.
    ordered = sorted(chapters.items(), key=lambda kv: _chapter_sort_key(kv[0]))
    result = []
    for i, (ch_name, sections) in enumerate(ordered):
        result.append({
            "chapter_num":   i + 1,
            "chapter_name":  ch_name,
            "short_name":    ch_name.split(" - ")[-1].strip() if " - " in ch_name else ch_name,
            "section_count": len(sections),
            "sections":      sorted(sections, key=_section_sort_key),
            "badge":         CHAPTER_BADGES[i % len(CHAPTER_BADGES)],
        })
    return result


def _fetch_ipc_chapters():
    docs = list(ipc_collection.find({}, {"_id": 0, "section_number": 1, "chapter": 1,
                                          "title": 1, "section_text": 1, "description": 1,
                                          "meaning": 1, "ai_summary": 1, "punishment": 1,
                                          "key_points": 1, "offence_category": 1}))
    chapters = {}
    for d in docs:
        ch = (d.get("chapter") or "General").strip()
        if ch not in chapters:
            chapters[ch] = []
        chapters[ch].append(d)

    ordered = sorted(chapters.items(), key=lambda kv: _chapter_sort_key(kv[0]))
    result = []
    for i, (ch_name, sections) in enumerate(ordered):
        result.append({
            "chapter_num":   i + 1,
            "chapter_name":  ch_name,
            "short_name":    ch_name.split(" - ")[-1].strip() if " - " in ch_name else ch_name,
            "section_count": len(sections),
            "sections":      sorted(sections, key=_section_sort_key),
            "badge":         CHAPTER_BADGES[i % len(CHAPTER_BADGES)],
        })
    return result


# ── Cache ──────────────────────────────────────────────────────────────────────
import time as _time
_CH_CACHE: dict = {}
_CH_CACHE_TTL = 600  # 10 min


def _get_chapters(law_code: str):
    global _CH_CACHE
    key = law_code.upper()
    cached = _CH_CACHE.get(key)
    if cached and (_time.monotonic() - cached[1]) < _CH_CACHE_TTL:
        return cached[0]
    data = _fetch_bns_chapters() if key == "BNS" else _fetch_ipc_chapters()
    _CH_CACHE[key] = (data, _time.monotonic())
    return data


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/tutor/chapters/{law_code}")
@limiter.limit("60/minute")
def get_chapters(request: Request, law_code: str):
    """Return all chapters for BNS or IPC with metadata (no sections data to keep response small)."""
    try:
        chapters = _get_chapters(law_code)
        # Strip sections data from list endpoint
        return [
            {
                "chapter_num":   ch["chapter_num"],
                "chapter_name":  ch["chapter_name"],
                "short_name":    ch["short_name"],
                "section_count": ch["section_count"],
                "badge":         ch["badge"],
            }
            for ch in chapters
        ]
    except Exception as e:
        return []


@router.get("/tutor/chapter/{law_code}/{chapter_num}/sections")
@limiter.limit("60/minute")
def get_chapter_sections(request: Request, law_code: str, chapter_num: int):
    """Return all sections in a given chapter."""
    try:
        chapters = _get_chapters(law_code)
        chapter = next((ch for ch in chapters if ch["chapter_num"] == chapter_num), None)
        if not chapter:
            return {"error": "Chapter not found", "sections": []}
        secs = []
        for s in chapter["sections"]:
            pun = _pun_to_str(s.get("punishment"))
            secs.append({
                "section_number": s.get("section_number", ""),
                "title":          s.get("title", ""),
                "text":           s.get("section_text") or s.get("description") or "",
                "summary":        s.get("ai_summary") or s.get("meaning") or "",
                "punishment":     pun,
                "key_points":     s.get("key_points") or [],
                "definitions":    s.get("important_definitions") or [],
                "is_punishable":  bool(s.get("is_punishable") or pun),
            })
        return {
            "chapter_num":  chapter_num,
            "chapter_name": chapter["chapter_name"],
            "short_name":   chapter["short_name"],
            "badge":        chapter["badge"],
            "sections":     secs,
        }
    except Exception as e:
        return {"error": str(e), "sections": []}


# ── AI lesson generation ───────────────────────────────────────────────────────

class LessonRequest(BaseModel):
    law_code:       str
    section_number: str
    section_title:  str
    section_text:   str
    punishment:     Optional[str] = ""
    mode:           Optional[str] = "general"   # single unified mode (legacy values accepted, ignored)
    language:       Optional[str] = "English"
    context:        Optional[str] = ""          # surrounding sections for continuity


@router.post("/tutor/lesson")
@limiter.limit("30/minute")
def generate_lesson(request: Request, body: LessonRequest):
    """Generate a structured AI lesson for one section — JD teaching style (Groq, fast)."""

    # ── Native script names — critical for model to use the right script ────────
    NATIVE_SCRIPT = {
        "Hindi":     "हिन्दी",
        "Kannada":   "ಕನ್ನಡ",
        "Tamil":     "தமிழ்",
        "Telugu":    "తెలుగు",
        "Marathi":   "मराठी",
        "Malayalam": "മലയാളം",
    }

    lang   = (body.language or "English").strip()
    native = NATIVE_SCRIPT.get(lang, lang)   # e.g. "Kannada" → "ಕನ್ನಡ"

    # ── Language block — placed FIRST in system prompt so model obeys it ────────
    if lang != "English":
        lang_block = (
            f"═══════════════════════════════════════════\n"
            f"OUTPUT LANGUAGE: {lang} — {native}\n"
            f"YOU MUST WRITE EVERY JSON TEXT VALUE IN {lang.upper()} USING {native} SCRIPT.\n"
            f"Do NOT write any field value in English.\n"
            f"Section numbers, law codes (BNS, IPC), and JSON keys stay in English.\n"
            f"═══════════════════════════════════════════"
        )
        user_lang_prefix = (
            f"[MANDATORY: Write ALL text field values in {lang} ({native} script). "
            f"Zero English in values.]\n\n"
        )
    else:
        lang_block       = ""
        user_lang_prefix = ""

    # ── Unified teaching style (former citizen + student modes merged) ──────────
    mode_desc = (
        "The learner may be a curious citizen OR a law student. Explain every concept in plain, "
        "everyday language FIRST, then immediately give the formal legal term in brackets or as a "
        "'Legal term:' callout so terminology is learned as they go. Use real-world analogies, and "
        "keep any court-application detail short so a first-time reader is never overwhelmed."
    )

    # Extra fields — plain-language aids AND terminology, always present
    mode_extra_fields = """,
  "analogy": "A relatable everyday Indian analogy comparing this law to something from daily life — 1-2 sentences.",
  "citizen_summary": "One plain sentence any non-lawyer can repeat to explain what this law means.",
  "action_steps": ["2-4 short practical steps a person should take if this situation happens to them or around them — e.g. 'Do not sign anything before reading it', 'File an FIR at the nearest police station'. Each step one sentence, everyday words."],
  "legal_definition": "Formal legal definition as interpreted by Indian courts or the statute — 1-2 sentences, prefixed naturally so it reads as a 'Legal term' callout.",
  "court_application": "ONE short court-application example: how a court applies this section's key element in practice — 2 sentences maximum, kept simple." """

    # Checkpoint question style — real-life scenario, plain wording, one element decides
    checkpoint_style = (
        "a real-life situation asking what the person should do or which legal element decides the "
        "outcome (e.g. 'Ravi's landlord locks his belongings inside the flat. What should Ravi do?'). "
        "Plain everyday language in the question; the explanation may name the formal legal term"
    )

    law_full = "BNS 2023 (Bharatiya Nyaya Sanhita)" if body.law_code.upper() == "BNS" else "IPC 1860 (Indian Penal Code)"

    system = f"""{lang_block}

You are JD, a passionate Indian law professor teaching {law_full} in a live voice classroom.
{mode_desc}

TEACHING RULES:
1. Understand the English legal text, then write ALL explanations in {lang} ({native}).
2. Teach the ACTUAL section given below — never a generic summary. Break down what THIS
   specific section really says, clause by clause, and define each important term it uses.
3. NEVER copy the legal text verbatim. Explain it thoroughly in your own words.
4. "real_example" is MANDATORY — a vivid 2-3 sentence story with a named Indian character showing when this law applies.
5. "spoken_script" is what JD says aloud — a warm, flowing monologue that genuinely teaches the section, NOT a list.

Return ONLY a valid JSON object with these exact keys (ALL text values in {lang} — {native}):
{{
  "simple_title": "({lang}) short friendly title for this section",
  "why_it_exists": "({lang}) 3-4 sentences: why this law was made, the real-world problem it solves, and what would go wrong without it",
  "plain_explanation": "({lang}) A THOROUGH explanation — 6 to 9 sentences. Walk through THIS section part by part: what each important term means, what exactly it requires (the ingredients that must all be present), and how the parts fit together. Ground every point in the real legal text above. Simple own words, never a verbatim copy.",
  "key_concepts": ["({lang}) each item names one key legal term or ingredient FROM THIS SECTION and defines it in a short sentence, e.g. 'Dishonest intention — taking something to wrongfully gain or cause loss'. Give 3 to 5."],
  "real_example": "({lang}) REQUIRED: vivid 2-3 sentence story with named Indian character",
  "when_applies": "({lang}) 3-4 sentences on the exact situations where this section applies — tie each to an ingredient of the section",
  "when_not_applies": "({lang}) 2-3 sentences on key exceptions and borderline cases where this section does NOT apply",
  "remember": "({lang}) one memorable takeaway sentence",
  "spoken_script": "({lang} — {native} SCRIPT ONLY) 130-170 word spoken lesson JD reads aloud that TRULY teaches this section: a hook, then a clear part-by-part explanation of what the section means and its key terms, then the real-life story, then the key takeaway. Warm teacher voice, flowing sentences, no lists.",
  "checkpoint_question": {{
    "question": "({lang}) MCQ — must be {checkpoint_style}",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": "A",
    "explanation": "({lang}) why correct and why others are wrong"
  }}{mode_extra_fields}
}}
Output ONLY the JSON object. No markdown. No text outside the JSON braces."""

    user_text = (
        f"{user_lang_prefix}"
        f"Teach this legal section in depth. Remember: write ALL text values in {lang} ({native}).\n\n"
        f"Law: {body.law_code} | Section {body.section_number}: {body.section_title}\n"
        f"FULL Legal Text (English — understand it fully, then teach THIS exact section in {lang}, "
        f"breaking down each part and term):\n{body.section_text[:2200] or 'Use your knowledge of this section.'}\n\n"
        f"Punishment: {body.punishment or 'N/A'}\n"
        f"Context (nearby sections): {body.context[:200] if body.context else 'None'}"
    )

    def _fallback(spoken: str = ""):
        title = body.section_title or f"Section {body.section_number}"
        return {
            "ok": False,
            "lesson": {
                "simple_title": title,
                "why_it_exists": "",
                "plain_explanation": f"{body.section_text[:300]}".strip(),
                "key_concepts": [],
                "real_example": "",
                "when_applies": "",
                "when_not_applies": "",
                "remember": title,
                "spoken_script": spoken or title,
                "checkpoint_question": None,
            },
        }

    # ── Single content call ───────────────────────────────────────────────────
    # Sarvam AI (Sarvam-105b) allows only ~1 concurrent request per key, so the
    # old two-parallel-calls design starved one of them (empty spoken script).
    # Instead we make ONE Sarvam call that returns BOTH the display fields AND
    # the spoken_script — half the latency, no concurrency conflict.
    try:
        # Deeper lessons need more output headroom (English/Groq path).
        data = _lesson_display_json(system, user_text, lang, max_tokens=2600)
    except Exception as exc:
        logger.error("[Tutor] Lesson generation failed: %s", exc)
        return _fallback()

    if not isinstance(data, dict) or not data.get("plain_explanation"):
        logger.warning("[Tutor] JSON parse failed for section %s — using fallback", body.section_number)
        return _fallback()

    # spoken_script now comes from the same JSON. If the model omitted it,
    # assemble a spoken lesson from the fields we already have (no extra call),
    # and only as a last resort make one dedicated call.
    spoken = (data.get("spoken_script") or "").strip()
    if not spoken:
        parts = [data.get("simple_title"), data.get("plain_explanation"),
                 data.get("real_example"), data.get("remember")]
        spoken = " ".join(p.strip() for p in parts if p and p.strip())
    if not spoken:
        try:
            spoken = generate_teaching_script(
                law_code=body.law_code, section_number=body.section_number,
                section_title=body.section_title, section_text=body.section_text or "",
                punishment=body.punishment or "", mode="general",
                language=lang, append_end_prompt=False,
            )
        except Exception:
            spoken = data.get("plain_explanation", "")
    data["spoken_script"] = spoken

    return {"ok": True, "lesson": data}


# ── Chapter intro / greeting ────────────────────────────────────────────────────

class ChapterIntroRequest(BaseModel):
    law_code:       str
    chapter_name:   str
    section_titles: List[str] = []
    language:       Optional[str] = "English"


@router.post("/tutor/chapter-intro")
@limiter.limit("30/minute")
def chapter_intro(request: Request, body: ChapterIntroRequest):
    """A warm spoken greeting JD delivers when a chapter opens — generated in the
    learner's language in NATIVE SCRIPT (Groq plain-text, reliable in every
    supported language, unlike the romanised frontend templates)."""
    try:
        text = generate_chapter_intro(
            law_code       = body.law_code,
            chapter_name   = body.chapter_name,
            section_titles = body.section_titles or [],
            language       = body.language or "English",
        )
        return {"ok": True, "intro": text}
    except Exception as exc:
        logger.error("[Tutor] Chapter intro failed: %s", exc)
        return {"ok": False, "intro": ""}


# ── Assessment generation ──────────────────────────────────────────────────────

class AssessRequest(BaseModel):
    law_code:     str
    chapter_num:  int
    chapter_name: str
    sections:     List[dict]          # [{section_number, title, text, punishment}]
    mode:         Optional[str] = "general"   # legacy values accepted, ignored
    language:     Optional[str] = "English"


@router.post("/tutor/assess")
@limiter.limit("10/minute")
def generate_assessment(request: Request, body: AssessRequest):
    """Generate a 10-question chapter-end assessment."""
    lang_note = f"Write questions in {body.language}." if body.language != "English" else ""
    q_count = 10

    # Build context from sections
    context_lines = []
    for s in body.sections[:15]:
        pun = _pun_to_str(s.get("punishment", ""))
        context_lines.append(
            f"Section {s.get('section_number')}: {s.get('title')}\n"
            f"Content: {str(s.get('text') or s.get('section_text') or '')[:300]}\n"
            f"Punishment: {pun or 'N/A'}"
        )
    context_str = "\n---\n".join(context_lines)

    mode_instructions = (
        "Write questions in plain everyday language with real-life scenarios, but test genuine "
        "understanding: mix conceptual, definition-based, and application questions. When a formal "
        "legal term matters, use it and let the explanation define it simply."
    )

    mix_instructions = (
        f"- 5 Multiple Choice (4 options A/B/C/D)\n- 3 True/False\n- 2 Scenario-based (short case, pick the correct law application)"
    )

    system = f"""You are an expert Indian law exam setter creating a chapter-end assessment.
{mode_instructions}
{lang_note}

Generate EXACTLY {q_count} questions. Mix these types:
{mix_instructions}

Output ONLY valid JSON array with exactly {q_count} objects:
[
  {{
    "type": "mcq",
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": "B",
    "explanation": "...",
    "topic": "concept name this tests"
  }},
  {{
    "type": "tf",
    "question": "True or False: ...",
    "options": ["A) True", "B) False"],
    "correct": "A",
    "explanation": "...",
    "topic": "..."
  }}
]
No markdown fences. Only the JSON array."""

    user_text = f"""Create a {q_count}-question assessment for:
Law: {body.law_code} | {body.chapter_name}

Chapter Content:
{context_str}"""

    def _parse_questions(raw: str) -> list:
        """Strip markdown fences, parse JSON, return list or raise."""
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        # Sometimes the model wraps in {"questions": [...]}
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and "questions" in parsed:
            parsed = parsed["questions"]
        if not isinstance(parsed, list):
            raise ValueError("Response is not a JSON array")
        return parsed

    def _validate(questions: list) -> list:
        validated = []
        for i, q in enumerate(questions[:q_count]):
            validated.append({
                "id":          i,
                "type":        q.get("type", "mcq"),
                "question":    q.get("question", ""),
                "options":     q.get("options", ["A) True", "B) False"]),
                "correct":     q.get("correct", "A"),
                "explanation": q.get("explanation", ""),
                "topic":       q.get("topic", "General"),
            })
        return validated

    # ── Groq (primary for all tutor functions) ────────────────────────────────
    try:
        raw_groq = generate_groq_json_response(
            system, user_text,
            temperature=0.3,
            max_tokens=2000,
        )
        validated = _validate(_parse_questions(raw_groq))
        if validated:
            return {"ok": True, "questions": validated, "total": len(validated)}
        raise ValueError("Empty question list from Groq")
    except Exception as groq_err:
        logger.error(f"[Tutor/Assess] Groq failed ({groq_err}); generating basic fallback questions")

    # ── Hardcoded fallback using section titles ────────────────────────────────
    try:
        fallback_qs = []
        for i, s in enumerate(body.sections[:q_count]):
            title = s.get("title") or s.get("section_title", f"Section {i+1}")
            sec_num = s.get("section_number", "")
            fallback_qs.append({
                "id":          i,
                "type":        "mcq",
                "question":    f"Which of the following best describes {body.law_code} Section {sec_num} — {title}?",
                "options":     [
                    f"A) It deals with {title}",
                    "B) It defines a civil dispute between parties",
                    "C) It is not part of Indian criminal law",
                    "D) It was introduced before 1860",
                ],
                "correct":     "A",
                "explanation": f"{body.law_code} Section {sec_num} covers {title}.",
                "topic":       title,
            })
        if fallback_qs:
            return {"ok": True, "questions": fallback_qs, "total": len(fallback_qs)}
    except Exception:
        pass

    return {"ok": False, "error": "All generation methods failed", "questions": [], "total": 0}


# ── Performance analysis ───────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    law_code:       str
    chapter_name:   str
    score:          int
    total:          int
    correct_topics: List[str]
    wrong_topics:   List[str]
    mode:           Optional[str] = "general"   # legacy values accepted, ignored
    language:       Optional[str] = "English"


@router.post("/tutor/analyze")
@limiter.limit("20/minute")
def analyze_performance(request: Request, body: AnalyzeRequest):
    """Generate AI performance feedback after assessment."""
    pct = round((body.score / body.total) * 100) if body.total else 0
    grade = "Excellent" if pct >= 90 else "Good" if pct >= 70 else "Needs Revision"
    lang_note = f"Respond in {body.language}." if body.language != "English" else ""

    system = f"""You are JD, a supportive law tutor. Give encouraging but honest feedback.
{lang_note}
Keep the response warm, motivating, and concise (under 150 words total).
Output ONLY valid JSON:
{{
  "message": "Personalized 2-sentence encouraging message addressing the student's performance",
  "strong_areas": ["topic 1", "topic 2"],
  "weak_areas": ["topic 1", "topic 2"],
  "recommendations": ["specific study tip 1", "specific study tip 2", "specific study tip 3"],
  "next_step": "One clear actionable sentence"
}}"""

    user_text = f"""Student completed {body.chapter_name} ({body.law_code})
Score: {body.score}/{body.total} ({pct}%) — {grade}
Strong topics: {', '.join(body.correct_topics[:5]) or 'None identified'}
Weak topics:   {', '.join(body.wrong_topics[:5]) or 'None identified'}"""

    try:
        raw = (generate_groq_json_response(system, user_text, temperature=0.5, max_tokens=400) or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        return {
            "ok":      True,
            "score":   body.score,
            "total":   body.total,
            "pct":     pct,
            "grade":   grade,
            "passed":  pct >= 70,
            "analysis": data,
        }
    except Exception as e:
        return {
            "ok":    False,
            "score": body.score,
            "total": body.total,
            "pct":   pct,
            "grade": grade,
            "passed": pct >= 70,
            "analysis": {
                "message":         f"You scored {pct}% — {'great work!' if pct >= 70 else 'keep practicing!'}",
                "strong_areas":    body.correct_topics[:3],
                "weak_areas":      body.wrong_topics[:3],
                "recommendations": ["Review weak sections", "Re-read key definitions", "Take notes on concepts"],
                "next_step":       "Continue studying to improve your understanding.",
            },
        }


# ── In-lesson doubt answering ──────────────────────────────────────────────────

class DoubtRequest(BaseModel):
    law_code:       str
    section_number: str
    section_title:  str
    section_text:   Optional[str] = ""
    question:       str
    mode:           Optional[str] = "general"     # legacy values accepted, ignored
    language:       Optional[str] = "English"
    reexplain:      Optional[bool] = False        # learner said "still not clear" → new angle
    history:        Optional[list] = None         # [{q, a}] previous doubt turns this section


@router.post("/tutor/doubt")
@limiter.limit("30/minute")
def answer_doubt(request: Request, body: DoubtRequest):
    """Answer a learner's in-lesson doubt about the current section using Groq (fast).
    Unified style: plain words first, formal legal term called out as it's used."""
    # Convert frontend {q, a} history into (role, text) turns so re-explains
    # never repeat an analogy JD already used.
    history_turns = []
    for h in (body.history or [])[-4:]:
        if isinstance(h, dict):
            if h.get("q"):
                history_turns.append(("user", str(h["q"])[:300]))
            if h.get("a"):
                history_turns.append(("assistant", str(h["a"])[:400]))
    try:
        answer = generate_doubt_answer(
            law_code=body.law_code,
            section_number=body.section_number,
            section_title=body.section_title,
            section_text=body.section_text or "",
            question=body.question,
            history=history_turns,
            language=body.language or "English",
            ask_clear=False,
            reexplain=bool(body.reexplain),
            mode="general",
        )
        return {"ok": True, "answer": answer}
    except Exception as e:
        logger.error("[Tutor] Doubt answer failed: %s", e)
        return {"ok": False, "answer": "I couldn't process your question right now. Please try again.", "error": str(e)}
