"""
Quiz router — /quiz/generate, /quiz/submit
Dual-source generation: enriched laws_collection (IPC+BNS) + raw bns_collection.
7 diverse question types, BNS-first labeling, correct-answer label always validated.
"""
import random
from datetime import datetime
from typing import Optional, List

import os
import json
import re
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import queries_collection, bns_collection
from app.routers import get_all_laws, get_current_user_email_optional

router = APIRouter(tags=["Quiz"])
limiter = Limiter(key_func=get_remote_address)

# ── Distractor pools ──────────────────────────────────────────────────────────
_PUNISHMENT_POOL = [
    "Up to 6 months imprisonment",
    "Up to 1 year imprisonment or fine",
    "Up to 2 years imprisonment and fine",
    "Up to 3 years imprisonment and fine",
    "Up to 5 years imprisonment and fine",
    "Up to 7 years imprisonment and fine",
    "Up to 10 years imprisonment and fine",
    "Up to 14 years imprisonment and fine",
    "Life imprisonment and fine",
    "Death or life imprisonment and fine",
    "Minimum 7 years to life imprisonment",
    "Fine only, no imprisonment",
    "Rigorous imprisonment for 3 years",
    "Simple imprisonment up to 1 year",
    "Community service",
    "Imprisonment for life with fine",
    "Minimum 10 years to life imprisonment",
]

_CATEGORIES = [
    "Crimes Against Person",
    "Crimes Against Property",
    "Crimes Against State",
    "Sexual Offences",
    "Fraud and Cheating",
    "Public Order",
    "Defamation",
    "Kidnapping",
    "Domestic Violence",
]

_BNS_CHAPTERS = [
    "Chapter I - Preliminary",
    "Chapter II - Of Punishments",
    "Chapter III - General Exceptions",
    "Chapter IV - Of Abetment, Criminal Conspiracy and Attempt",
    "Chapter V - Of Offences Against the State",
    "Chapter VI - Of Offences Relating to the Army, Navy and Air Force",
    "Chapter VII - Of Offences Relating to Elections",
    "Chapter VIII - Offences Against Public Tranquillity",
    "Chapter IX - Of Offences by or Relating to Public Servants",
    "Chapter X - Of Contempts of the Lawful Authority of Public Servants",
    "Chapter XI - Of False Evidence and Offences Against Public Justice",
    "Chapter XII - Of Offences Relating to Coin, Government Stamps and Currency",
    "Chapter XIII - Of Offences Relating to Weights and Measures",
    "Chapter XIV - Of Offences Affecting the Public Health, Safety and Convenience",
    "Chapter XV - Of Offences Relating to Religion",
    "Chapter XVI - Of Offences Affecting the Human Body",
    "Chapter XVII - Of Offences Against Women and Children",
    "Chapter XVIII - Of Offences Against Property",
    "Chapter XIX - Of Criminal Misappropriation of Property",
    "Chapter XX - Of Criminal Breach of Trust",
    "Chapter XXI - Of Receiving Stolen Property",
    "Chapter XXII - Of Cheating",
    "Chapter XXIII - Of Fraudulent Deeds and Disposition of Property",
    "Chapter XXIV - Of Mischief",
    "Chapter XXV - Of Criminal Trespass and House-trespass",
    "Chapter XXVI - Of Forgery",
    "Chapter XXVII - Of Offences Relating to Documents",
    "Chapter XXVIII - Of Criminal Intimidation, Insult and Annoyance",
]

# ── BNS data cache ────────────────────────────────────────────────────────────
_BNS_CACHE: tuple = (None, 0.0)
import time as _time

def _get_bns_sections() -> List[dict]:
    """Cache BNS sections from MongoDB (5-minute TTL)."""
    global _BNS_CACHE
    data, fetched_at = _BNS_CACHE
    if data is None or (_time.monotonic() - fetched_at) > 300:
        data = list(bns_collection.find({}, {"_id": 0}))
        _BNS_CACHE = (data, _time.monotonic())
    return data


def _pick_distractors(pool: list, correct: str, n: int = 3) -> list:
    """Pick n unique distractors from pool that are not the correct answer."""
    choices = [str(x) for x in pool if x and isinstance(x, str) and str(x) != correct]
    random.shuffle(choices)
    result = []
    seen = set()
    for c in choices:
        if c not in seen:
            seen.add(c)
            result.append(c)
        if len(result) == n:
            break
    pad = ["As determined by court", "Varies by court discretion",
           "No punishment prescribed", "Compoundable offence only"]
    for p in pad:
        if len(result) >= n:
            break
        if p != correct and p not in seen:
            result.append(p)
    return result[:n]


def _make_labeled(correct_text: str, distractor_texts: list) -> tuple:
    """
    Shuffle correct + distractors, assign A/B/C/D labels.
    Returns (labeled_options, correct_label).
    """
    all_opts = [correct_text] + distractor_texts
    random.shuffle(all_opts)
    labeled = [{"label": chr(65 + i), "text": t} for i, t in enumerate(all_opts)]
    correct_label = next(o["label"] for o in labeled if o["text"] == correct_text)
    return labeled, correct_label


def _truncate(text: str, max_chars: int = 200) -> str:
    """Truncate description text cleanly at a word boundary."""
    if not text or len(text) <= max_chars:
        return text or ""
    return text[:max_chars].rstrip() + '…'


def _build_question_from_enriched(law: dict, all_laws: list, all_punishments: list) -> Optional[dict]:
    """
    Build one MCQ from enriched law document (IPC+BNS cross-reference data).
    Prioritizes BNS section as primary, IPC as historical reference.
    """
    title = law.get("title", "").strip()
    if not title:
        return None

    ipc        = str(law.get("ipc_section") or "").strip()
    bns        = str(law.get("bns_section") or "").strip()
    punishment = (law.get("punishment") or "").strip()
    bns_pun    = (law.get("bns_punishment") or "").strip()
    category   = (law.get("category") or "").strip()
    bailable   = law.get("bailable")

    description = (
        law.get("simple_explanation") or
        law.get("description") or ""
    ).strip()

    # BNS-first labels
    bns_tag = f"BNS {bns}" if bns else ""
    ipc_tag = f"IPC {ipc}" if ipc else ""
    section_label = bns_tag or ipc_tag

    all_ipc_sections = [
        str(l["ipc_section"])
        for l in all_laws
        if l.get("ipc_section") and str(l["ipc_section"]) != ipc
    ]
    all_bns_sections = [
        str(l["bns_section"])
        for l in all_laws
        if l.get("bns_section") and str(l["bns_section"]) != bns
    ]

    q_types = []

    valid_pun = punishment and punishment.lower() not in ("n/a", "as per court", "not applicable", "")
    if valid_pun:
        q_types.append("punishment")

    if ipc and len(all_ipc_sections) >= 3:
        q_types.append("section_ipc")

    if bns and len(all_bns_sections) >= 3:
        q_types.append("section_bns")

    if category:
        q_types.append("category")

    if bailable is not None:
        q_types.append("bailable")

    if bns_pun and bns_pun != punishment:
        q_types.append("bns_punishment")

    desc_trunc = _truncate(description, 130) if description else ""
    if title and desc_trunc and len(desc_trunc) > 30:
        q_types.append("title_id")

    if not q_types:
        return None

    qtype = random.choice(q_types)
    base_exp = f"{section_label}: " if section_label else ""
    clean_desc = _truncate(description, 200)

    if qtype == "punishment":
        question = f"What is the punishment under {bns_tag or section_label} for '{title}'?"
        distractors = _pick_distractors(_PUNISHMENT_POOL + all_punishments, punishment)
        options, correct_label = _make_labeled(punishment, distractors)
        explanation = (
            f"{base_exp}The prescribed punishment is '{punishment}'."
            + (f" Under old IPC ({ipc_tag}) the punishment was similar." if ipc_tag else "")
            + f" {clean_desc}"
        )

    elif qtype == "section_ipc":
        question = f"Under which IPC section was '{title}' originally defined? (Now replaced by BNS)"
        chosen    = random.sample(all_ipc_sections, min(3, len(all_ipc_sections)))
        distractors = [f"IPC {s}" for s in chosen]
        while len(distractors) < 3:
            distractors.append(f"IPC {random.randint(100, 511)}")
        options, correct_label = _make_labeled(ipc_tag, distractors)
        explanation = (
            f"'{title}' was IPC {ipc}, now replaced by {bns_tag} in the "
            f"Bharatiya Nyaya Sanhita 2023. {clean_desc}"
        )

    elif qtype == "section_bns":
        question = f"Under which BNS section is '{title}' covered in the new law?"
        chosen    = random.sample(all_bns_sections, min(3, len(all_bns_sections)))
        distractors = [f"BNS {s}" for s in chosen]
        while len(distractors) < 3:
            distractors.append(f"BNS {random.randint(50, 358)}")
        options, correct_label = _make_labeled(bns_tag, distractors)
        explanation = (
            f"'{title}' is covered under {bns_tag} in the Bharatiya Nyaya Sanhita 2023"
            + (f" (previously IPC {ipc})" if ipc else "")
            + f". {clean_desc}"
        )

    elif qtype == "category":
        question = f"Under which legal category does '{title}' ({section_label}) fall?"
        all_cats = list({l.get("category") for l in all_laws if l.get("category") and l.get("category") != category})
        dist_cats = all_cats if len(all_cats) >= 3 else [c for c in _CATEGORIES if c != category]
        random.shuffle(dist_cats)
        options, correct_label = _make_labeled(category, dist_cats[:3])
        explanation = f"'{title}' {section_label} falls under the category: '{category}'. {clean_desc}"

    elif qtype == "bailable":
        bail_text = "Bailable" if bailable else "Non-Bailable"
        other     = "Non-Bailable" if bailable else "Bailable"
        question  = f"Under BNS, is '{title}' ({section_label}) a bailable or non-bailable offence?"
        distractors = [other, "Depends on the court", "Compoundable with court permission"]
        options, correct_label = _make_labeled(bail_text, distractors)
        explanation = f"'{title}' {section_label} is a {bail_text} offence under BNS 2023. {clean_desc}"

    elif qtype == "bns_punishment":
        question = f"What is the punishment for '{title}' under {bns_tag} (BNS 2023)?"
        distractors = _pick_distractors(_PUNISHMENT_POOL + all_punishments, bns_pun)
        options, correct_label = _make_labeled(bns_pun, distractors)
        explanation = (
            f"Under {bns_tag} (BNS 2023), the punishment is '{bns_pun}'."
            + (f" Under old {ipc_tag} it was '{punishment}'." if ipc_tag and punishment else "")
            + f" {clean_desc}"
        )

    elif qtype == "title_id":
        other_titles = [
            l.get("title", "").strip()
            for l in all_laws
            if l.get("ipc_section") and l.get("title", "").strip() and l.get("title", "").strip() != title
        ]
        dist_titles = random.sample(other_titles, min(3, len(other_titles)))
        question = f'Which offence is described here: "{desc_trunc}"?'
        options, correct_label = _make_labeled(title, dist_titles)
        explanation = (
            f"The correct answer is '{title}'"
            + (f" ({section_label})" if section_label else "")
            + f". {clean_desc}"
        )

    else:
        return None

    if not any(o["label"] == correct_label for o in options):
        return None

    return {
        "id":          str(law["_id"]),
        "ipc_section": ipc,
        "bns_section": bns,
        "title":       title,
        "category":    category,
        "question":    question.strip(),
        "options":     options,
        "correct":     correct_label,
        "explanation": explanation.strip(),
        "q_type":      qtype,
        "source":      "enriched",
    }


def _build_question_from_bns(bns_law: dict, all_bns: list) -> Optional[dict]:
    """
    Build one MCQ purely from BNS raw data.
    Generates BNS-native question types:
      - bns_section_id: identify section number from description
      - bns_chapter: identify chapter from section title
      - bns_punishment: identify punishment for an offence
      - bns_definition: match a legal term to its BNS meaning
    """
    title   = (bns_law.get("title") or bns_law.get("section_title") or bns_law.get("Offense") or "").strip()
    section = str(bns_law.get("section_number") or bns_law.get("Section") or "").strip()
    chapter = (bns_law.get("chapter") or "").strip()
    desc    = (bns_law.get("description") or bns_law.get("ai_summary") or "").strip()
    pun     = bns_law.get("punishment")
    summary = (bns_law.get("ai_summary") or "").strip()

    if not title or not section:
        return None

    # Determine punishment text
    pun_text = ""
    if isinstance(pun, dict):
        parts = []
        if pun.get("maximum_imprisonment"):
            parts.append(pun["maximum_imprisonment"])
        if pun.get("fine"):
            parts.append(f"fine {pun['fine']}")
        pun_text = " and ".join(parts) if parts else ""
    elif isinstance(pun, str):
        pun_text = pun.strip()

    q_types = []

    q_types.append("bns_section_id")

    if chapter:
        q_types.append("bns_chapter")

    if pun_text and pun_text.lower() not in ("n/a", "not applicable", ""):
        q_types.append("bns_punishment")

    # Check for definitions
    defs = bns_law.get("important_definitions", [])
    if defs and len(defs) >= 1:
        q_types.append("bns_definition")

    if not q_types:
        return None

    qtype = random.choice(q_types)
    all_sections = [str(b.get("section_number", "")) for b in all_bns if str(b.get("section_number", "")) != section]
    random.shuffle(all_sections)

    if qtype == "bns_section_id":
        desc_trunc = _truncate(desc, 120)
        question   = f'Which BNS section is described here: "{desc_trunc}"?'
        dist_secs  = random.sample(all_sections, min(3, len(all_sections)))
        distractors = [f"BNS {s}" for s in dist_secs]
        while len(distractors) < 3:
            distractors.append(f"BNS {random.randint(1, 358)}")
        options, correct_label = _make_labeled(f"BNS {section}", distractors)
        explanation = f"BNS {section} — '{title}'. {summary or _truncate(desc, 200)}"

    elif qtype == "bns_chapter":
        question = f"Under which chapter of the BNS does Section {section} ('{title}') fall?"
        all_chapters = list({b.get("chapter") for b in all_bns if b.get("chapter") and b.get("chapter") != chapter})
        dist_chapters = all_chapters if len(all_chapters) >= 3 else [c for c in _BNS_CHAPTERS if c != chapter]
        random.shuffle(dist_chapters)
        options, correct_label = _make_labeled(chapter, dist_chapters[:3])
        explanation = f"BNS {section} '{title}' falls under {chapter}. {summary}"

    elif qtype == "bns_punishment":
        question    = f"What is the punishment prescribed under BNS {section} for '{title}'?"
        distractors = _pick_distractors(_PUNISHMENT_POOL, pun_text)
        options, correct_label = _make_labeled(pun_text, distractors)
        explanation = (
            f"Under BNS {section} ('{title}'), the prescribed punishment is: {pun_text}. "
            + (summary or "")
        )

    elif qtype == "bns_definition":
        defn = random.choice(defs)
        term    = defn.get("term", "").strip()
        meaning = defn.get("meaning", "").strip()
        if not term or not meaning:
            return None
        question = f"Under BNS {section}, how is the term '{term}' defined?"
        # Build distractors from other definitions in the same section
        other_meanings = [
            d["meaning"] for d in defs
            if d.get("meaning") and d["meaning"] != meaning
        ]
        random.shuffle(other_meanings)
        dist_pool = other_meanings[:2]
        # Pad from generic legal definitions
        generic = [
            "Any act punishable under law",
            "A person above eighteen years of age",
            "An authorised government official",
            "Any electronic document or record",
        ]
        for g in generic:
            if len(dist_pool) >= 3:
                break
            if g != meaning:
                dist_pool.append(g)
        options, correct_label = _make_labeled(meaning, dist_pool[:3])
        explanation = (
            f"Under BNS {section}, '{term}' means: {meaning}. "
            f"This section covers '{title}'."
        )

    else:
        return None

    if not any(o["label"] == correct_label for o in options):
        return None

    return {
        "id":          f"bns_{section}",
        "ipc_section": "",
        "bns_section": section,
        "title":       title,
        "category":    chapter.split(" - ")[-1] if " - " in chapter else chapter,
        "question":    question.strip(),
        "options":     options,
        "correct":     correct_label,
        "explanation": explanation.strip(),
        "q_type":      qtype,
        "source":      "bns_native",
    }


def _build_ipc_question(law: dict, all_laws: list, all_punishments: list) -> Optional[dict]:
    """
    Build one MCQ focused purely on IPC 1860 from enriched data.
    Questions ask about IPC section numbers, punishments, categories — using the dataset.
    """
    ipc = str(law.get("ipc_section") or "").strip()
    if not ipc or ipc in ("N/A", ""):
        return None

    title    = law.get("title", "").strip()
    bns      = str(law.get("bns_section") or "").strip()

    # Punishment can be a plain string or a dict (BNS-style); normalise to string
    pun_raw = law.get("punishment")
    if isinstance(pun_raw, dict):
        pun_parts = []
        if pun_raw.get("maximum_imprisonment"):
            pun_parts.append(pun_raw["maximum_imprisonment"])
        if pun_raw.get("minimum_imprisonment"):
            pun_parts.append(f"minimum {pun_raw['minimum_imprisonment']}")
        if pun_raw.get("fine"):
            pun_parts.append(f"fine {pun_raw['fine']}")
        punishment = " and ".join(pun_parts) if pun_parts else ""
    else:
        punishment = (pun_raw or "").strip()

    category   = (law.get("category") or "").strip()
    bailable   = law.get("bailable")
    description = (law.get("simple_explanation") or law.get("description") or "").strip()

    if not title:
        return None

    ipc_tag = f"IPC {ipc}"
    bns_tag = f"BNS {bns}" if bns and bns not in ("N/A", "") else ""

    all_ipc_sections = [
        str(l["ipc_section"])
        for l in all_laws
        if l.get("ipc_section") and str(l["ipc_section"]) not in ("N/A", "") and str(l["ipc_section"]) != ipc
    ]

    q_types = []

    valid_pun = punishment and punishment.lower() not in ("n/a", "as per court", "not applicable", "")
    if valid_pun:
        q_types.append("ipc_punishment")

    q_types.append("ipc_section_id")

    if category:
        q_types.append("category")

    if bailable is not None:
        q_types.append("bailable")

    desc_trunc = _truncate(description, 130) if description else ""
    if desc_trunc and len(desc_trunc) > 30:
        q_types.append("title_id")

    if not q_types:
        return None

    qtype = random.choice(q_types)
    clean_desc = _truncate(description, 200)
    replaced_note = f" (Now replaced by {bns_tag} in BNS 2023.)" if bns_tag else ""

    if qtype == "ipc_punishment":
        question = f"What was the punishment under {ipc_tag} for '{title}' in the Indian Penal Code 1860?"
        distractors = _pick_distractors(_PUNISHMENT_POOL + all_punishments, punishment)
        options, correct_label = _make_labeled(punishment, distractors)
        explanation = f"{ipc_tag}: The punishment for '{title}' was '{punishment}'.{replaced_note} {clean_desc}"

    elif qtype == "ipc_section_id":
        question = f"Under which section of the Indian Penal Code 1860 was '{title}' defined?"
        chosen = random.sample(all_ipc_sections, min(3, len(all_ipc_sections)))
        distractors = [f"IPC {s}" for s in chosen]
        while len(distractors) < 3:
            distractors.append(f"IPC {random.randint(100, 511)}")
        options, correct_label = _make_labeled(ipc_tag, distractors)
        explanation = f"'{title}' was defined under {ipc_tag} in the Indian Penal Code 1860.{replaced_note} {clean_desc}"

    elif qtype == "category":
        question = f"Under which legal category does '{title}' ({ipc_tag}) fall in IPC 1860?"
        all_cats = list({l.get("category") for l in all_laws if l.get("category") and l.get("category") != category})
        dist_cats = all_cats if len(all_cats) >= 3 else [c for c in _CATEGORIES if c != category]
        random.shuffle(dist_cats)
        options, correct_label = _make_labeled(category, dist_cats[:3])
        explanation = f"'{title}' {ipc_tag} falls under the category '{category}' in IPC 1860. {clean_desc}"

    elif qtype == "bailable":
        bail_text = "Bailable" if bailable else "Non-Bailable"
        other = "Non-Bailable" if bailable else "Bailable"
        question = f"Under IPC 1860, is '{title}' ({ipc_tag}) a bailable or non-bailable offence?"
        distractors = [other, "Depends on the judge", "Compoundable with court permission"]
        options, correct_label = _make_labeled(bail_text, distractors)
        explanation = f"'{title}' {ipc_tag} is a {bail_text} offence under IPC 1860.{replaced_note} {clean_desc}"

    elif qtype == "title_id":
        other_titles = [
            l.get("title", "").strip()
            for l in all_laws
            if l.get("ipc_section") and l.get("title", "").strip() and l.get("title", "").strip() != title
        ]
        dist_titles = random.sample(other_titles, min(3, len(other_titles)))
        question = f'Which IPC 1860 offence matches this description: "{desc_trunc}"?'
        options, correct_label = _make_labeled(title, dist_titles)
        explanation = f"The correct answer is '{title}' ({ipc_tag}).{replaced_note} {clean_desc}"

    else:
        return None

    if not any(o["label"] == correct_label for o in options):
        return None

    return {
        "id":          f"ipc_{ipc}_{qtype}",
        "ipc_section": ipc,
        "bns_section": bns,
        "title":       title,
        "category":    category,
        "question":    question.strip(),
        "options":     options,
        "correct":     correct_label,
        "explanation": explanation.strip(),
        "q_type":      qtype,
        "source":      "ipc_1860",
    }


def _generate_quiz_with_ai(all_laws: list, count: int, category: Optional[str] = None, section: Optional[str] = None, title: Optional[str] = None) -> dict:
    """Fallback to Gemini AI generation if no dataset data available."""
    from app.services.ai import generate_json_response

    pool = list(all_laws)
    if not pool:
        return {"total": 0, "questions": []}

    target_law = None
    if section:
        target_law = next((l for l in pool if str(l.get("section", "")) == str(section) or str(l.get("ipc_section", "")) == str(section)), None)

    if target_law:
        sample = [target_law]
        focus_instruction = f"Generate exactly {count} multiple-choice questions focusing ENTIRELY on this specific law."
    else:
        random.shuffle(pool)
        sample = pool[:min(count, len(pool))]
        focus_instruction = f"Generate exactly {count} multiple-choice questions based on the following Indian laws. Focus on BNS 2023 where possible."

    context_lines = []
    for i, law in enumerate(sample, 1):
        context_lines.append(
            f"Law {i}: Section {law.get('section', 'N/A')}\n"
            f"Title: {law.get('title', '')}\n"
            f"Content: {law.get('content', '')[:800]}"
        )
    context_str = "\n---\n".join(context_lines)

    prompt = f"""You are an expert Indian legal educator. {focus_instruction}
Each question MUST have exactly 4 options labeled A, B, C, D.
Focus on BNS 2023 provisions where available.

Laws Context:
{context_str}

Output ONLY valid JSON in this exact structure, nothing else:
[
  {{
    "question": "What is the penalty for...",
    "options": [
      {{"label": "A", "text": "Option 1"}},
      {{"label": "B", "text": "Option 2"}},
      {{"label": "C", "text": "Option 3"}},
      {{"label": "D", "text": "Option 4"}}
    ],
    "correct": "B",
    "explanation": "Brief explanation of why B is correct based on the law."
  }}
]"""
    try:
        raw = generate_json_response(
            "You are an expert Indian legal educator. Output ONLY valid JSON.",
            prompt,
            temperature=0.3,
            max_tokens=1500,
        ).strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        questions = json.loads(raw)
        for i, q in enumerate(questions):
            q["id"] = f"ai_q_{i}"
            q["ipc_section"] = "N/A"
            q["bns_section"] = "N/A"
            q["title"] = "General Law"
            q["category"] = category or "General"
            q["q_type"] = "ai_generated"
            q["source"] = "ai"

        return {"total": len(questions), "questions": questions}
    except Exception as e:
        print(f"AI Quiz Generation Error: {e}")
        return {"total": 0, "questions": []}


# ── Full-dataset bank builder ──────────────────────────────────────────────────
def _build_full_bank(
    mode: str,
    enriched_pool: list,
    bns_pool: list,
    enriched: list,
    bns_sections: list,
    all_punishments: list,
) -> list:
    """
    Build a question bank from the ENTIRE dataset (all laws, all valid q_types).
    Each law is attempted 3 times to capture different q_types via random.choice.
    Returns a deduplicated list of all buildable questions.
    """
    bank: list  = []
    seen_keys: set = set()

    def bank_add(q):
        if not q:
            return
        key = f"{q['id']}::{q['q_type']}"
        if key not in seen_keys:
            seen_keys.add(key)
            bank.append(q)

    if mode == "ipc_only":
        ipc_pool = [l for l in enriched_pool if l.get("ipc_section") and str(l.get("ipc_section")) not in ("N/A", "")]
        random.shuffle(ipc_pool)
        for law in ipc_pool:
            for _ in range(4):   # 4 attempts → covers multiple q_types per law
                try: bank_add(_build_ipc_question(law, enriched, all_punishments))
                except Exception: pass
        # Top-up with enriched if IPC-only bank is thin
        if len(bank) < 10:
            for law in enriched_pool:
                for _ in range(3):
                    try: bank_add(_build_question_from_enriched(law, enriched, all_punishments))
                    except Exception: pass

    elif mode == "bns_only":
        shuffled_bns = list(bns_pool)
        random.shuffle(shuffled_bns)
        for bns_law in shuffled_bns:
            for _ in range(4):
                try: bank_add(_build_question_from_bns(bns_law, bns_sections))
                except Exception: pass

    elif mode == "enriched_only":
        shuffled_e = list(enriched_pool)
        random.shuffle(shuffled_e)
        for law in shuffled_e:
            for _ in range(4):
                try: bank_add(_build_question_from_enriched(law, enriched, all_punishments))
                except Exception: pass

    else:  # mixed — both enriched and BNS native
        shuffled_e = list(enriched_pool)
        shuffled_bns = list(bns_pool)
        random.shuffle(shuffled_e)
        random.shuffle(shuffled_bns)
        for law in shuffled_e:
            for _ in range(3):
                try: bank_add(_build_question_from_enriched(law, enriched, all_punishments))
                except Exception: pass
        for bns_law in shuffled_bns:
            for _ in range(3):
                try: bank_add(_build_question_from_bns(bns_law, bns_sections))
                except Exception: pass

    random.shuffle(bank)
    return bank


# ── Bank cache (5-minute TTL, keyed by mode+pool sizes) ──────────────────────
_BANK_CACHE: dict = {}
_BANK_TTL = 300  # seconds


def _get_or_build_bank(mode, enriched_pool, bns_pool, enriched, bns_sections, all_punishments) -> list:
    cache_key = f"{mode}_{len(enriched_pool)}_{len(bns_pool)}"
    cached = _BANK_CACHE.get(cache_key)
    if cached and (_time.monotonic() - cached[1]) < _BANK_TTL:
        # Return a freshly shuffled copy of cached bank (preserve randomness)
        shuffled = list(cached[0])
        random.shuffle(shuffled)
        return shuffled
    bank = _build_full_bank(mode, enriched_pool, bns_pool, enriched, bns_sections, all_punishments)
    _BANK_CACHE[cache_key] = (list(bank), _time.monotonic())
    return bank


# ── Main quiz generation route ─────────────────────────────────────────────────
@router.get("/quiz/generate")
@limiter.limit("30/minute")
def generate_quiz(
    request: Request,
    count: int = 10,
    category: Optional[str] = None,
    section: Optional[str] = None,
    title: Optional[str] = None,
    mode: Optional[str] = "mixed",
    exclude_ids: Optional[str] = "",   # "id::qtype,id::qtype,..." already-seen keys
):
    """
    Generate MCQ questions from the FULL BNS + IPC dataset.
    Builds a complete bank of all possible questions then samples `count`,
    skipping any IDs listed in `exclude_ids` so questions never repeat across sessions.

    mode: 'mixed'         = blend of enriched + BNS-native questions (default)
          'bns_only'      = only BNS 2023 native questions
          'ipc_only'      = only IPC 1860 questions
          'enriched_only' = IPC+BNS cross-reference comparison questions
    exclude_ids: comma-separated "id::qtype" strings (sent by frontend from localStorage)
    """
    # Parse already-seen question keys from client
    excluded_keys: set = set()
    if exclude_ids:
        for item in exclude_ids.split(","):
            item = item.strip()
            if item:
                excluded_keys.add(item)

    try:
        all_laws = get_all_laws()
        enriched = [l for l in all_laws if l.get("ipc_section")]
    except Exception as e:
        print(f"[WARN] MongoDB get_all_laws failed: {e}")
        return _generate_quiz_with_ai([], count, category, section, title)

    try:
        bns_sections = _get_bns_sections()
    except Exception as e:
        print(f"[WARN] BNS sections fetch failed: {e}")
        bns_sections = []

    if not enriched and not bns_sections:
        return _generate_quiz_with_ai(all_laws, count, category, section, title)

    # ── Build pools (apply section/category filters) ───────────────────────────
    enriched_pool = list(enriched)
    bns_pool      = [b for b in bns_sections if b.get("title") or b.get("section_title") or b.get("Offense")]

    if section:
        sec_matches     = [l for l in enriched if str(l.get("ipc_section","")) == str(section) or str(l.get("bns_section","")) == str(section)]
        bns_sec_matches = [b for b in bns_sections if str(b.get("section_number","")) == str(section)]
        if sec_matches:     enriched_pool = sec_matches * 8 + enriched
        if bns_sec_matches: bns_pool      = bns_sec_matches * 8 + list(bns_sections)
    elif category:
        cat_matches = [l for l in enriched if l.get("category") == category]
        if len(cat_matches) >= 4: enriched_pool = cat_matches
        cat_kw  = category.lower().replace("_", " ")
        bns_cat = [b for b in bns_sections if cat_kw in (b.get("chapter") or "").lower()]
        if len(bns_cat) >= 4: bns_pool = bns_cat

    # Prefer punishable BNS sections for richer questions
    bns_punishable = [b for b in bns_pool if b.get("is_punishable") or b.get("punishment") or b.get("important_definitions")]
    if len(bns_punishable) >= 5:
        bns_pool = bns_punishable

    all_punishments = list({
        str(p).strip()
        for l in all_laws
        for p in [l.get("punishment")]
        if p and isinstance(p, str) and p.strip()
    })

    # ── Get or build the full question bank ────────────────────────────────────
    try:
        bank = _get_or_build_bank(mode, enriched_pool, bns_pool, enriched, bns_sections, all_punishments)
    except Exception as e:
        print(f"[ERROR] Bank build failed for mode={mode}: {e}")
        return {"total": 0, "questions": []}

    if not bank:
        return {"total": 0, "questions": []}

    # ── Filter out already-seen questions ──────────────────────────────────────
    available = [q for q in bank if f"{q['id']}::{q['q_type']}" not in excluded_keys]

    # If fewer than requested remain (all questions seen), use full bank (cycle reset)
    if len(available) < count:
        available = list(bank)
        random.shuffle(available)

    # ── Sample count questions ─────────────────────────────────────────────────
    questions = available[:count]
    return {"total": len(questions), "questions": questions}


# ── Quiz result persistence ────────────────────────────────────────────────────
class QuizSubmitRequest(BaseModel):
    score:      int
    total:      int
    category:   Optional[str]       = None
    percentage: Optional[float]     = None
    answers:    Optional[List[dict]] = None


@router.post("/quiz/submit")
@limiter.limit("30/minute")
def submit_quiz(
    request: Request,
    data:       QuizSubmitRequest,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    """Persist quiz results to user history. Anonymous users are supported."""
    pct = data.percentage or (
        round((data.score / data.total) * 100, 1) if data.total else 0
    )
    grade = (
        "Excellent"         if pct >= 80
        else "Good"         if pct >= 60
        else "Needs Improvement"
    )
    summary = (
        f"Quiz completed: {data.score}/{data.total} ({pct}%) — {grade}. "
        f"Category: {data.category or 'All'}"
    )

    doc_id = None
    try:
        result = queries_collection.insert_one({
            "email":      user_email,
            "question":   f"[Quiz] {data.category or 'General'} — {data.total} questions",
            "mode":       "quiz",
            "answer":     summary,
            "score":      data.score,
            "total":      data.total,
            "percentage": pct,
            "grade":      grade,
            "category":   data.category,
            "answers":    data.answers or [],
            "bookmarked": False,
            "created_at": datetime.utcnow(),
        })
        doc_id = str(result.inserted_id)
    except Exception as e:
        print("Quiz Submit Error:", e)

    return {
        "id":         doc_id,
        "score":      data.score,
        "total":      data.total,
        "percentage": pct,
        "grade":      grade,
        "saved":      doc_id is not None,
    }
