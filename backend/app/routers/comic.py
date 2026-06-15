import json
import re
import os
import time
import logging
import requests
import threading
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import bns_collection, normalize_law_doc
from app.services.ai import generate_json_response, generate_groq_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/comic-story", tags=["comic"])
limiter = Limiter(key_func=get_remote_address)

# HF_API_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
# HF_HEADERS = {"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY', '')}"}
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"

_image_generation_lock = threading.Lock()

# ── Constants ─────────────────────────────────────────────────────────────────
_IMAGE_TIMEOUT = 60          # seconds per HuggingFace request
_IMAGE_MAX_RETRIES = 3       # max attempts per image
_IMAGE_BACKOFF_BASE = 3      # seconds: 3, 6, 12

_LLM_MODEL = "llama-3.3-70b-versatile"
_LLM_FALLBACK_MODEL = "llama-3.1-8b-instant"
_LLM_MAX_TOKENS = 4000
_LLM_TEMPERATURE = 0.3


# ── Image endpoint with retry ────────────────────────────────────────────────

# Fallback HuggingFace API if Gemini image generation fails due to quota limit
HF_API_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell"
HF_HEADERS = {"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY', '')}"}

@router.get("/image")
@limiter.limit("30/minute")
def get_comic_image(request: Request, prompt: str):
    """Proxy HuggingFace FLUX with retry + backoff, locking for rate limits, using router.huggingface.co to bypass DNS blocks."""
    last_error = None

    HF_API_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell"
    HF_HEADERS = {"Authorization": f"Bearer {os.getenv('HUGGINGFACE_API_KEY', '')}"}

    for attempt in range(1, _IMAGE_MAX_RETRIES + 1):
        try:
            logger.info(f"[Comic/Image] Attempt {attempt}/{_IMAGE_MAX_RETRIES} — waiting for lock...")
            
            with _image_generation_lock:
                logger.info(f"[Comic/Image] Lock acquired! Requesting from HuggingFace...")
                response = requests.post(
                    HF_API_URL,
                    headers=HF_HEADERS,
                    json={"inputs": prompt},
                    timeout=_IMAGE_TIMEOUT,
                )

                if response.status_code == 200:
                    content_type = response.headers.get("content-type", "image/jpeg")
                    if "image" in content_type:
                        logger.info(f"[Comic/Image] Success on attempt {attempt}")
                        return Response(content=response.content, media_type=content_type)
                    else:
                        logger.warning(f"[Comic/Image] Got 200 but non-image content: {response.text[:200]}")
                        last_error = f"Non-image response: {response.text[:200]}"
                elif response.status_code == 503:
                    logger.warning(f"[Comic/Image] 503 Model loading (attempt {attempt})")
                    last_error = "Model is loading, please wait"
                elif response.status_code == 429:
                    logger.warning(f"[Comic/Image] 429 Rate limited (attempt {attempt})")
                    last_error = "Rate limited"
                else:
                    logger.error(f"[Comic/Image] HTTP {response.status_code}: {response.text[:200]}")
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"

        except requests.exceptions.Timeout:
            logger.warning(f"[Comic/Image] Timeout after {_IMAGE_TIMEOUT}s (attempt {attempt})")
            last_error = f"Timeout after {_IMAGE_TIMEOUT}s"

        except requests.exceptions.ConnectionError as e:
            logger.error(f"[Comic/Image] Connection error (attempt {attempt}): {e}")
            last_error = f"Connection error: {e}"

        except Exception as e:
            logger.error(f"[Comic/Image] Unexpected error (attempt {attempt}): {e}")
            last_error = str(e)

        # Backoff before next attempt (skip if last attempt)
        if attempt < _IMAGE_MAX_RETRIES:
            wait = _IMAGE_BACKOFF_BASE * (2 ** (attempt - 1))  # 3s, 6s, 12s
            logger.info(f"[Comic/Image] Waiting {wait}s before retry...")
            time.sleep(wait)

    logger.error(f"[Comic/Image] All {_IMAGE_MAX_RETRIES} attempts failed: {last_error}")
    raise HTTPException(status_code=502, detail=f"Image generation failed after {_IMAGE_MAX_RETRIES} attempts: {last_error}")


# ── Request model ─────────────────────────────────────────────────────────────

class ComicRequest(BaseModel):
    topic: str
    language: Optional[str] = "English"


class ComicExplainRequest(BaseModel):
    section_number: Optional[str] = ""
    section_title:  Optional[str] = ""
    tagline:        Optional[str] = ""
    panels:         Optional[List[dict]] = []   # [{number, title, caption}]
    key_takeaway:   Optional[str] = ""
    question:       Optional[str] = ""           # optional follow-up about the comic
    language:       Optional[str] = "English"


# ── Law search helpers ────────────────────────────────────────────────────────

def _keyword_search_bns(query: str, limit: int = 3) -> List[dict]:
    """
    Fast keyword scoring over bns_collection.
    Used as fallback when $text search returns nothing.
    """
    words = [w.lower() for w in re.split(r"\W+", query) if len(w) > 2]
    scored = []
    for doc in bns_collection.find({}):
        score = 0
        combined = " ".join([
            doc.get("title", ""),
            doc.get("description", ""),
            " ".join(doc.get("keywords", [])),
            str(doc.get("section_number", "")),
        ]).lower()
        for w in words:
            if w in combined:
                score += 1
        for kw in doc.get("keywords", []):
            if kw.lower() in query.lower():
                score += 3
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [normalize_law_doc(d) for _, d in scored[:limit]]


def _find_relevant_bns_laws(query: str, limit: int = 3) -> List[dict]:
    """
    Find relevant BNS laws for a topic.
    Tries: (1) exact section number, (2) $text search, (3) keyword scoring.
    Always returns normalized docs.
    """
    docs = []

    # 1. Try exact section number match
    sec_match = re.search(r'\b(\d+[a-zA-Z]?)\b', query)
    if sec_match:
        sec = sec_match.group(1)
        doc = bns_collection.find_one({"section_number": sec})
        if doc:
            docs.append(normalize_law_doc(doc))

    # 2. MongoDB $text search
    if len(docs) < limit:
        try:
            text_docs = list(
                bns_collection.find(
                    {"$text": {"$search": query}},
                    {"score": {"$meta": "textScore"}},
                )
                .sort([("score", {"$meta": "textScore"})])
                .limit(limit - len(docs))
            )
            seen = {d.get("section_number") for d in docs}
            for d in text_docs:
                if d.get("section_number") not in seen:
                    docs.append(normalize_law_doc(d))
                    seen.add(d.get("section_number"))
        except Exception as e:
            logger.warning(f"[Comic] $text search error: {e}")

    # 3. Keyword scoring fallback
    if not docs:
        docs = _keyword_search_bns(query, limit)

    return docs


def _extract_json(raw: str) -> dict:
    """
    Robustly extract JSON from LLM output.
    Strips markdown code fences and parses JSON.
    """
    # Strip any markdown code fences before parsing
    cleaned = re.sub(r'```(?:json)?|```', '', raw.strip(), flags=re.IGNORECASE).strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.debug(f"JSON Parse Error: {e}")

    # Find the outermost { ... } block
    start = cleaned.find("{")
    end   = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass

    return {}


# ── Image prompt builder ──────────────────────────────────────────────────────

_STYLE_DIRECTIVE = (
    "Clean flat-color comic book illustration, vibrant colors, clean bold line-art, "
    "educational graphic novel, detailed background, expressive characters, "
    "highly consistent character design, professional comic panel layout"
)

def _build_image_prompt(panel: dict, characters: dict, character_visuals: dict, section_title: str) -> str:
    """
    Build a detailed, story-aware image prompt for a single comic panel.
    Uses explicit visual descriptions to ensure character consistency across panels.
    """
    scene = panel.get("scene_description", "")
    caption = panel.get("caption", "")

    # Extract detailed visual descriptions
    accused_vis = character_visuals.get("accused", f"{characters.get('accused', 'Man')}, Indian person in everyday clothes")
    victim_vis = character_visuals.get("victim", f"{characters.get('victim', 'Person')}, Indian person in everyday clothes")
    officer_vis = character_visuals.get("officer", "Indian Police Officer in standard khaki uniform")
    judge_vis = character_visuals.get("judge", "Indian Judge in black robes")

    # Build scene-specific details based on panel number/title
    scene_context = scene or caption

    prompt = (
        f"{_STYLE_DIRECTIVE}. "
        f"Scene: {scene_context}. "
        f"Characters present: {accused_vis}. {victim_vis}. {officer_vis}. {judge_vis}. "
        f"Setting is a realistic Indian location. "
        f"No text, no speech bubbles, no captions, no writing anywhere in the image."
    )

    # Trim to max 450 chars for API limits
    return prompt[:450]


# ── LLM call with retry + fallback ────────────────────────────────────────────

def _call_llm_for_comic(prompt: str) -> dict:
    """
    Call Gemini LLM for comic story generation (story generation uses Gemini only).
    """
    sys_prompt = "You are Vidhan AI Legal Comic Story Generator for India. Return ONLY valid JSON."

    for attempt in range(1, 3):  # 2 attempts
        try:
            logger.info(f"[Comic/LLM] Calling Gemini (attempt {attempt})")
            raw_json = generate_json_response(
                system_prompt=sys_prompt,
                user_prompt=prompt,
                temperature=_LLM_TEMPERATURE,
                max_tokens=_LLM_MAX_TOKENS,
            )
            logger.info(f"[Comic/LLM] Got response from Gemini ({len(raw_json)} chars)")
            data = _extract_json(raw_json or "")
            if data and data.get("panels"):
                return data
            logger.warning("[Comic/LLM] Empty or missing panels in response, retrying...")
        except Exception as e:
            logger.error(f"[Comic/LLM] attempt {attempt} failed: {e}")
            if attempt < 2:
                time.sleep(3)

    return {}


# ── Main route ────────────────────────────────────────────────────────────────

@router.post("")
async def generate_comic(req: ComicRequest):
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")

    try:
        # ── 1. Retrieve relevant laws ──────────────────────────────────────
        docs = _find_relevant_bns_laws(topic, limit=2)

        if not docs:
            docs = _keyword_search_bns(topic, limit=2)

        primary_doc    = docs[0] if docs else {}
        section_number = primary_doc.get("bns_section") or primary_doc.get("section_number", "N/A")
        section_title  = primary_doc.get("title", "General Law")
        description    = primary_doc.get("description", "")
        punishment     = primary_doc.get("punishment", "")

        section_content = f"Description: {description}\n"
        if punishment:
            section_content += f"Punishment: {punishment}\n"

        # ── 2. Build prompt (6-panel format) ───────────────────────────────
        prompt = f"""You are Vidhan AI Legal Comic Story Generator for India.

Retrieved BNS Law:
Section Number: {section_number}
Section Title: {section_title}
{section_content}

Create a 6-panel legal comic story based ONLY on the law above.

Scenario Generation Rules:
1. Setting: Realistic Indian everyday location (café, market, bus, office, school, street, home, park, shop)
2. Characters: Always named — Accused and Victim get common Indian names; Officer and Judge are unnamed (just "Officer" and "Judge").
3. Crime: Must directly demonstrate the PRIMARY offence — no edge cases.
4. Evidence: Include CCTV OR witness testimony OR physical evidence in Panel 4.
5. Judgment: Always guilty verdict with exact punishment range from the section.
6. Tone: Educational, neutral, non-graphic. No gore, sexual content, communal/caste references.
7. Speech: English primary (max 10 words per speech bubble).
8. Panel Sequence MUST BE:
   Panel 1: Scene setup — establish characters and setting before the crime
   Panel 2: The criminal act — show the offence being committed
   Panel 3: Complaint filed — victim reports to police
   Panel 4: Investigation — evidence gathered, accused identified
   Panel 5: Court hearing — trial proceedings
   Panel 6: The Verdict — guilty verdict with exact punishment

Return ONLY valid JSON matching this exact schema:
{{
  "section_number": "{section_number}",
  "section_title": "{section_title}",
  "act_name": "Bharatiya Nyaya Sanhita",
  "tagline": "A catchy one-line quote summarizing the law in simple language (in double quotes)",
  "characters": {{
    "accused": "Indian name",
    "victim": "Indian name",
    "officer": "Police Officer",
    "judge": "Judge"
  }},
  "character_visuals": {{
    "accused": "Detailed physical description (age, gender, clothing colors, glasses/beard). E.g. '25yo Indian man, green shirt, black pants'",
    "victim": "Detailed physical description (age, gender, clothing colors, accessories). E.g. '30yo Indian woman, red sari, gold necklace'",
    "officer": "Indian Police Officer in standard khaki uniform",
    "judge": "Indian Judge in black robes and glasses"
  }},
  "panels": [
    {{
      "number": 1,
      "title": "A short evocative scene title like 'A quiet day in the market...'",
      "scene_description": "Detailed visual description of the scene (2-3 sentences): what characters are doing, where they are, what objects are visible, the mood/atmosphere",
      "speech_bubbles": [
        {{"character": "victim", "type": "speech", "text": "max 10 words!"}},
        {{"character": "accused", "type": "thought", "text": "max 10 words!"}}
      ],
      "caption": "One sentence summarizing what happens in this panel"
    }},
    {{
      "number": 2,
      "title": "The act of [crime]...",
      "scene_description": "Detailed visual description showing the crime being committed",
      "speech_bubbles": [
        {{"character": "accused", "type": "speech", "text": "max 10 words!"}},
        {{"character": "victim", "type": "speech", "text": "max 10 words!"}}
      ],
      "caption": "One sentence summarizing the criminal act"
    }},
    {{
      "number": 3,
      "title": "Complaint is filed...",
      "scene_description": "Detailed visual description of victim at police station filing complaint",
      "speech_bubbles": [
        {{"character": "victim", "type": "speech", "text": "max 10 words!"}},
        {{"character": "officer", "type": "speech", "text": "max 10 words!"}}
      ],
      "caption": "One sentence about the complaint being registered"
    }},
    {{
      "number": 4,
      "title": "Investigation...",
      "scene_description": "Detailed visual description of police investigating, gathering evidence",
      "speech_bubbles": [
        {{"character": "officer", "type": "speech", "text": "max 10 words!"}},
        {{"character": "accused", "type": "speech", "text": "max 10 words!"}}
      ],
      "caption": "One sentence about investigation findings"
    }},
    {{
      "number": 5,
      "title": "In the Court...",
      "scene_description": "Detailed visual description of courtroom trial scene",
      "speech_bubbles": [
        {{"character": "judge", "type": "speech", "text": "max 10 words!"}},
        {{"character": "accused", "type": "speech", "text": "max 10 words!"}}
      ],
      "caption": "One sentence about the trial proceedings"
    }},
    {{
      "number": 6,
      "title": "The Verdict",
      "scene_description": "Detailed visual description of verdict being delivered, gavel, courtroom reaction",
      "speech_bubbles": [
        {{"character": "judge", "type": "speech", "text": "Guilty under BNS Section {section_number}!"}},
        {{"character": "judge_verdict", "type": "box", "text": "Punishment: [exact punishment from section]"}}
      ],
      "caption": "One sentence about the final verdict and justice being served"
    }}
  ],
  "key_takeaway": "2-3 sentences plain language explaining the core legal concept for a layperson",
  "why_applies": [
    "Each bullet ties a specific fact from the story to a legal element of the section",
    "E.g. 'Movable property involved (phone)'",
    "E.g. 'Property belonged to another person (Victim name)'",
    "E.g. 'Taken without the owner's permission'",
    "E.g. 'All essential ingredients of the offence are present'"
  ],
  "remember_message": "A short moral/civic lesson takeaway (1-2 sentences)",
  "section_details": {{
    "section": "{section_number}",
    "offence": "Name of offence",
    "type": "Cognizable / Non-Cognizable",
    "bailable": "Yes / No",
    "punishment": "Full punishment text from the section"
  }}
}}"""

        # ── 3. Call LLM ───────────────────────────────────────────────────
        logger.info(f"[Comic] Generating story for topic: {topic}")
        data = _call_llm_for_comic(prompt)

        if not data or not data.get("panels"):
            logger.error("[Comic] LLM returned empty or invalid data")
            raise HTTPException(status_code=500, detail="Failed to generate comic story")

        # ── 4. Build story-aware image prompts for each panel ──────────────
        characters = data.get("characters", {})
        character_visuals = data.get("character_visuals", {})
        sec_title = data.get("section_title", section_title)

        for panel in data.get("panels", []):
            panel["image_prompt"] = _build_image_prompt(panel, characters, character_visuals, sec_title)

        # Ensure required top-level fields have defaults
        data.setdefault("section_number", section_number)
        data.setdefault("section_title", section_title)
        data.setdefault("act_name", "Bharatiya Nyaya Sanhita")
        data.setdefault("tagline", f"Understanding {section_title} through a simple story")
        data.setdefault("key_takeaway", f"This section deals with {section_title} under BNS.")
        data.setdefault("why_applies", [
            "The essential elements of the offence are demonstrated in the story",
            "The accused's actions match the legal definition",
            "Evidence supports the charges",
            "All conditions for this section are met",
            "The court found sufficient grounds for conviction"
        ])
        data.setdefault("remember_message", "Know the law, respect the law. Legal awareness protects you and others.")
        data.setdefault("section_details", {
            "section": section_number,
            "offence": section_title,
            "type": "Cognizable",
            "bailable": "Yes",
            "punishment": str(punishment) if punishment else "As per section provisions"
        })
        data.setdefault("characters", {
            "accused": "Rahul",
            "victim": "Vikram",
            "officer": "Police Officer",
            "judge": "Judge"
        })

        logger.info(f"[Comic] Successfully generated {len(data.get('panels', []))}-panel comic for: {topic}")
        return data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Comic Route] Global error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Comic generation failed: {str(e)}")


# ── Explain the current comic (analyse what's on screen) ──────────────────────

@router.post("/explain")
@limiter.limit("30/minute")
def explain_comic(request: Request, body: ComicExplainRequest):
    """
    Explain the comic the user is currently looking at — in very simple words.
    If `question` is provided, answer that specific doubt about this comic.
    Powered by Groq (fast).
    """
    # Summarise what is actually visible in the comic (panel by panel).
    panel_lines = []
    for p in (body.panels or [])[:6]:
        num = p.get("number", "")
        title = (p.get("title") or "").strip()
        caption = (p.get("caption") or "").strip()
        line = f"Panel {num}: {title}".strip()
        if caption:
            line += f" — {caption}"
        panel_lines.append(line)
    story = "\n".join(panel_lines) or "No panel details available."

    lang_note = (
        f"Respond entirely in {body.language}."
        if body.language and body.language.lower() != "english"
        else "Respond in English."
    )

    section_ref = f"BNS Section {body.section_number}: {body.section_title}".strip(": ")

    if body.question and body.question.strip():
        task = (
            f"The student is looking at this comic and asks: \"{body.question.strip()}\"\n"
            "Answer their question in simple words, using the comic story to explain."
        )
    else:
        task = (
            "Explain this comic to the student in very simple words. Walk through what happens "
            "in the story, what crime took place, why this law applies, and what the punishment is. "
            "Make it feel like a friendly teacher explaining a picture story."
        )

    system = (
        "You are JD, a warm, friendly Indian law teacher. A student is looking at a legal comic "
        "story and wants to understand it. Explain in plain, everyday language a beginner can follow. "
        "Be clear and encouraging. Keep it to about 90-150 words. "
        "Output plain spoken text only — no markdown, no asterisks, no bullet symbols, no emojis. "
        + lang_note
    )

    user = (
        f"Legal comic about {section_ref}.\n"
        f"Tagline: {body.tagline}\n"
        f"Story panels:\n{story}\n"
        f"Key point: {body.key_takeaway}\n\n"
        f"{task}"
    )

    answer = generate_groq_text(system, user, temperature=0.4, max_tokens=500)
    if not answer:
        answer = (
            f"This comic explains {section_ref}. It shows a real-life situation where the law applies, "
            "from the crime taking place to the court giving its verdict. "
            + (f"In short: {body.key_takeaway}" if body.key_takeaway else "")
        ).strip()

    return {"ok": True, "explanation": answer}
