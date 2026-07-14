"""
Quiz router — /quiz/topics, /quiz/generate, /quiz/submit

Every question is built directly from the two dataset collections:
  • ipc_sections (IPC 1860, 577 sections)
  • bns_sections (BNS 2023, 358 sections)

Structure mirrors the dataset itself:
  /quiz/topics    → the REAL chapters of the chosen law (name, numeral, counts)
  /quiz/generate  → MCQs built from the real fields of each section document
                    (title, description/meaning, ai_summary, punishment,
                     chapter, illustrations, and the BNS→IPC cross-reference)

Modes: 'bns_only' | 'ipc_only' | 'enriched_only' (BNS↔IPC compare) | 'mixed'.
No AI generation — the quiz is 100% grounded in the dataset.
"""
import random
import re
import time as _time
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import queries_collection, bns_collection, ipc_collection
from app.routers import get_current_user_email_optional
from app.services.plan_gate import require_pro

# Quiz & Learning Hub is a Pro-plan feature — every endpoint requires Pro.
router = APIRouter(tags=["Quiz"], dependencies=[Depends(require_pro)])
limiter = Limiter(key_func=get_remote_address)

# ══════════════════════════════════════════════════════════════════════════════
# Dataset access (5-minute caches)
# ══════════════════════════════════════════════════════════════════════════════
_CACHE_TTL = 300
_BNS_CACHE: tuple = (None, 0.0)
_IPC_CACHE: tuple = (None, 0.0)

_BNS_FIELDS = {"_id": 0, "section_number": 1, "title": 1, "chapter": 1,
               "description": 1, "ai_summary": 1, "punishment": 1,
               "is_punishable": 1, "illustrations": 1, "ipc_section": 1,
               "important_definitions": 1}
_IPC_FIELDS = {"_id": 0, "section_number": 1, "title": 1, "chapter": 1,
               "section_text": 1, "meaning": 1, "ai_summary": 1,
               "punishment": 1, "offence_category": 1, "key_points": 1}


def _get_bns() -> List[dict]:
    global _BNS_CACHE
    data, at = _BNS_CACHE
    if data is None or (_time.monotonic() - at) > _CACHE_TTL:
        data = [d for d in bns_collection.find({}, _BNS_FIELDS)
                if d.get("section_number") and d.get("title")]
        _BNS_CACHE = (data, _time.monotonic())
    return data


def _get_ipc() -> List[dict]:
    global _IPC_CACHE
    data, at = _IPC_CACHE
    if data is None or (_time.monotonic() - at) > _CACHE_TTL:
        data = [d for d in ipc_collection.find({}, _IPC_FIELDS)
                if d.get("section_number") and d.get("title")]
        _IPC_CACHE = (data, _time.monotonic())
    return data


# ══════════════════════════════════════════════════════════════════════════════
# Chapter / section ordering (same logic as the tutor — real legislative order)
# ══════════════════════════════════════════════════════════════════════════════
_ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


def _roman_to_int(r: str) -> int:
    total, prev = 0, 0
    for ch in reversed(r.upper()):
        v = _ROMAN.get(ch, 0)
        total += -v if v < prev else v
        prev = v
    return total


def _chapter_sort_key(chapter_name: str):
    m = re.match(r"\s*chapter\s+([IVXLCDM]+)([A-Za-z]*)\b", chapter_name.strip(), re.IGNORECASE)
    if m:
        base = _roman_to_int(m.group(1))
        suffix = m.group(2).upper()
        sub = (ord(suffix[0]) - ord("A") + 1) if suffix else 0
        return (0, base, sub, chapter_name.lower())
    return (1, 10**9, 0, chapter_name.lower())


def _chapter_parts(chapter_name: str):
    """'Chapter XVI - Of Offences Affecting the Human Body' → ('XVI', 'Of Offences…')."""
    m = re.match(r"\s*chapter\s+([IVXLCDM]+[A-Za-z]*)\s*[-–—:]?\s*(.*)", chapter_name.strip(), re.IGNORECASE)
    if m:
        return m.group(1).upper(), (m.group(2) or "").strip() or chapter_name
    return "", chapter_name


# ══════════════════════════════════════════════════════════════════════════════
# Punishment formatter — the dataset stores punishments as nested dicts with
# case-specific keys, e.g. {"imprisonment": {"minimum": "3 Years", "maximum":
# "7 Years"}, "fine": true}. Flatten to a short readable phrase for MCQ options.
# ══════════════════════════════════════════════════════════════════════════════
_PUN_SKIP_KEYS = {"available", "reason", "note", "reference_section",
                  "reference_sections", "section_providing_punishment",
                  "applicable", "applicable_only_with"}


def _fmt_key(k: str) -> str:
    return k.replace("_", " ")


def _pun_flatten(pun, depth: int = 0) -> str:
    if pun is None or isinstance(pun, bool):
        return ""
    if isinstance(pun, str):
        return pun.strip()
    if isinstance(pun, (int, float)):
        return str(pun)
    if isinstance(pun, list):
        return ", ".join(filter(None, (_pun_flatten(p, depth + 1) for p in pun)))
    if isinstance(pun, dict):
        parts = []
        for k, v in pun.items():
            if k in _PUN_SKIP_KEYS:
                continue
            if isinstance(v, bool):
                if v:
                    parts.append(_fmt_key(k))
                continue
            sub = _pun_flatten(v, depth + 1)
            if sub:
                parts.append(f"{_fmt_key(k)} {sub}" if depth >= 1 else f"{_fmt_key(k)}: {sub}")
        return ("; " if depth == 0 else ", ").join(parts)
    return ""


def _pun_text(pun) -> str:
    """Readable punishment phrase, or '' when the section prescribes none."""
    if isinstance(pun, dict) and pun.get("available") is False:
        return ""
    text = _pun_flatten(pun)
    if not text or len(text) < 8:
        return ""
    # Sections like IPC 34 only explain that no separate punishment exists.
    if "does not prescribe" in text.lower() or "no separate punishment" in text.lower():
        return ""
    # Keep MCQ options readable: whole top-level parts up to ~150 chars.
    if len(text) > 150:
        kept = []
        for part in text.split("; "):
            if kept and len("; ".join(kept + [part])) > 150:
                break
            kept.append(part)
        text = "; ".join(kept) or text[:150]
    return text[0].upper() + text[1:]


def _doc_pun(doc: dict) -> str:
    """Punishment text for a doc, cached on the doc (docs live in the 5-min cache)."""
    if "_pun_cache" not in doc:
        doc["_pun_cache"] = _pun_text(doc.get("punishment"))
    return doc["_pun_cache"]


def _truncate(text: str, max_chars: int = 200) -> str:
    if not text or len(text) <= max_chars:
        return text or ""
    return text[:max_chars].rstrip() + "…"


# ══════════════════════════════════════════════════════════════════════════════
# Option helpers
# ══════════════════════════════════════════════════════════════════════════════
def _make_labeled(correct_text: str, distractor_texts: list) -> tuple:
    """Shuffle correct + distractors into A/B/C/D. Returns (options, correct_label)."""
    uniq = []
    for d in distractor_texts:
        if d and d != correct_text and d not in uniq:
            uniq.append(d)
    all_opts = [correct_text] + uniq[:3]
    random.shuffle(all_opts)
    labeled = [{"label": chr(65 + i), "text": t} for i, t in enumerate(all_opts)]
    correct_label = next(o["label"] for o in labeled if o["text"] == correct_text)
    return labeled, correct_label


def _section_distractors(doc: dict, pool: list, prefix: str, n: int = 3) -> list:
    """Other section numbers, preferring the SAME chapter (harder, fairer)."""
    sec = str(doc.get("section_number"))
    chapter = doc.get("chapter")
    same = [str(p["section_number"]) for p in pool
            if p.get("chapter") == chapter and str(p.get("section_number")) != sec]
    other = [str(p["section_number"]) for p in pool
             if p.get("chapter") != chapter and str(p.get("section_number")) != sec]
    random.shuffle(same)
    random.shuffle(other)
    out = []
    for s in same + other:
        if s not in out:
            out.append(s)
        if len(out) == n:
            break
    return [f"{prefix} {s}" for s in out]


def _text_distractors(doc: dict, pool: list, field, correct: str, n: int = 3) -> list:
    """Distinct values of `field` from other docs, same chapter preferred.
    `field` is a key name or a callable(doc) → str."""
    def get(p):
        v = field(p) if callable(field) else (p.get(field) or "")
        return str(v).strip()
    chapter = doc.get("chapter")
    same = [get(p) for p in pool if p.get("chapter") == chapter and p is not doc]
    other = [get(p) for p in pool if p.get("chapter") != chapter]
    random.shuffle(same)
    random.shuffle(other)
    out = []
    for t in same + other:
        if t and t != correct and t not in out:
            out.append(t)
        if len(out) == n:
            break
    return out


def _finalize(doc: dict, law: str, qtype: str, question: str,
              correct: str, distractors: list, explanation: str) -> Optional[dict]:
    if not correct or len(distractors) < 3:
        return None
    options, correct_label = _make_labeled(correct, distractors)
    if len(options) < 4:
        return None
    sec = str(doc.get("section_number"))
    chapter = doc.get("chapter") or ""
    return {
        "id":          f"{law}_{sec}",
        "ipc_section": sec if law == "ipc" else str(doc.get("ipc_section") or ""),
        "bns_section": sec if law in ("bns", "cmp") else "",
        "title":       doc.get("title", ""),
        "category":    _chapter_parts(chapter)[1],
        "question":    question.strip(),
        "options":     options,
        "correct":     correct_label,
        "explanation": explanation.strip(),
        "q_type":      qtype,
        "source":      {"bns": "bns_2023", "ipc": "ipc_1860", "cmp": "ipc_vs_bns"}[law],
    }


# ══════════════════════════════════════════════════════════════════════════════
# Question builders — one per (document, question-type), all from real fields
# ══════════════════════════════════════════════════════════════════════════════
def _bns_questions(doc: dict, pool: list) -> List[dict]:
    """All buildable questions for one BNS section document."""
    out = []
    sec = str(doc["section_number"])
    title = doc["title"].strip()
    chapter = (doc.get("chapter") or "").strip()
    desc = (doc.get("description") or "").strip()
    summary = (doc.get("ai_summary") or "").strip()
    tag = f"BNS {sec}"
    ipc_ref = f" (It replaced IPC {doc['ipc_section']}.)" if doc.get("ipc_section") else ""

    # 1) Which section number covers this offence?
    out.append(_finalize(
        doc, "bns", "section_id",
        f"Which section of the Bharatiya Nyaya Sanhita 2023 deals with '{title}'?",
        tag, _section_distractors(doc, pool, "BNS"),
        f"{tag} deals with '{title}'. {summary or _truncate(desc)}{ipc_ref}",
    ))

    # 2) Description → which offence/provision is this?
    if len(desc) > 40:
        out.append(_finalize(
            doc, "bns", "title_match",
            f'Which BNS 2023 provision is described here: "{_truncate(desc, 160)}"?',
            title, _text_distractors(doc, pool, "title", title),
            f"This describes '{title}' ({tag}). {summary}{ipc_ref}",
        ))

    # 3) Which chapter does the section belong to?
    if chapter:
        all_chapters = sorted({p.get("chapter") for p in pool if p.get("chapter")})
        ch_distractors = [c for c in all_chapters if c != chapter]
        random.shuffle(ch_distractors)
        out.append(_finalize(
            doc, "bns", "chapter_id",
            f"Under which chapter of the BNS 2023 does Section {sec} ('{title}') fall?",
            chapter, ch_distractors[:3],
            f"{tag} '{title}' falls under {chapter}. {summary}",
        ))

    # 4) Real punishment (the dataset's is_punishable flag is always False,
    #    so punishability is derived from the punishment field itself)
    pun = _doc_pun(doc)
    if pun:
        pun_pool = _text_distractors(doc, pool, _doc_pun, pun)
        out.append(_finalize(
            doc, "bns", "punishment",
            f"What punishment does {tag} ('{title}') prescribe?",
            pun, pun_pool,
            f"{tag} prescribes: {pun}. {summary}{ipc_ref}",
        ))

    # 5) Illustration → which section does it belong to?
    ills = [i for i in (doc.get("illustrations") or []) if isinstance(i, str) and len(i) > 30]
    if ills:
        out.append(_finalize(
            doc, "bns", "illustration",
            f'This illustration relates to which BNS section? "{_truncate(ills[0], 160)}"',
            f"{tag} — {title}",
            [f"BNS {str(p['section_number'])} — {p['title']}"
             for p in random.sample([x for x in pool if x is not doc], min(3, len(pool) - 1))],
            f"The illustration is from {tag} ('{title}'). {summary}",
        ))

    # 6) Term definitions (where the dataset has them)
    for d in (doc.get("important_definitions") or [])[:2]:
        term = (d.get("term") or "").strip()
        meaning = (d.get("meaning") or "").strip()
        if term and meaning:
            others = [x.get("meaning", "").strip()
                      for p in pool for x in (p.get("important_definitions") or [])
                      if x.get("meaning") and x["meaning"].strip() != meaning]
            generic = ["Any act punishable under law",
                       "A person above eighteen years of age",
                       "An authorised government official"]
            out.append(_finalize(
                doc, "bns", "definition",
                f"Under {tag}, how is the term '{term}' defined?",
                meaning, (others + generic)[:3],
                f"Under {tag}, '{term}' means: {meaning}",
            ))

    return [q for q in out if q]


def _ipc_questions(doc: dict, pool: list) -> List[dict]:
    """All buildable questions for one IPC section document."""
    out = []
    sec = str(doc["section_number"])
    title = doc["title"].strip()
    chapter = (doc.get("chapter") or "").strip()
    meaning = (doc.get("meaning") or "").strip()
    summary = (doc.get("ai_summary") or "").strip()
    tag = f"IPC {sec}"

    # 1) Which section number covers this offence?
    out.append(_finalize(
        doc, "ipc", "section_id",
        f"Under which section of the Indian Penal Code 1860 was '{title}' defined?",
        tag, _section_distractors(doc, pool, "IPC"),
        f"'{title}' was defined under {tag}. {summary or _truncate(meaning)}",
    ))

    # 2) Meaning → which offence/provision is this?
    if len(meaning) > 40:
        out.append(_finalize(
            doc, "ipc", "title_match",
            f'Which IPC 1860 provision is described here: "{_truncate(meaning, 160)}"?',
            title, _text_distractors(doc, pool, "title", title),
            f"This describes '{title}' ({tag}). {summary}",
        ))

    # 3) Which chapter does the section belong to?
    if chapter:
        all_chapters = sorted({p.get("chapter") for p in pool if p.get("chapter")})
        ch_distractors = [c for c in all_chapters if c != chapter]
        random.shuffle(ch_distractors)
        out.append(_finalize(
            doc, "ipc", "chapter_id",
            f"Under which chapter of the IPC 1860 does Section {sec} ('{title}') fall?",
            chapter, ch_distractors[:3],
            f"{tag} '{title}' falls under {chapter}. {summary}",
        ))

    # 4) Real punishment
    pun = _doc_pun(doc)
    if pun:
        pun_pool = _text_distractors(
            doc, pool, _doc_pun, pun,
        )
        out.append(_finalize(
            doc, "ipc", "punishment",
            f"What punishment did {tag} ('{title}') prescribe?",
            pun, pun_pool,
            f"{tag} prescribed: {pun}. {summary}",
        ))

    return [q for q in out if q]


def _compare_questions(doc: dict, mapped_pool: list) -> List[dict]:
    """IPC↔BNS cross-reference questions from BNS docs with a real ipc_section."""
    out = []
    sec = str(doc["section_number"])
    ipc = str(doc.get("ipc_section") or "").strip()
    if not ipc:
        return out
    title = doc["title"].strip()
    summary = (doc.get("ai_summary") or "").strip()

    ipc_distractors = _text_distractors(
        doc, mapped_pool, lambda p: f"IPC {p.get('ipc_section')}", f"IPC {ipc}")
    out.append(_finalize(
        doc, "cmp", "bns_to_ipc",
        f"'{title}' is covered by BNS {sec} in the new law. Which IPC 1860 section did it replace?",
        f"IPC {ipc}", ipc_distractors,
        f"BNS {sec} ('{title}') replaced IPC {ipc} when the BNS 2023 came into force. {summary}",
    ))

    bns_distractors = _text_distractors(
        doc, mapped_pool, lambda p: f"BNS {p.get('section_number')}", f"BNS {sec}")
    out.append(_finalize(
        doc, "cmp", "ipc_to_bns",
        f"IPC {ipc} ('{title}') corresponds to which section of the BNS 2023?",
        f"BNS {sec}", bns_distractors,
        f"IPC {ipc} ('{title}') is now BNS {sec} in the Bharatiya Nyaya Sanhita 2023. {summary}",
    ))

    pun = _doc_pun(doc)
    if pun:
        pun_pool = _text_distractors(doc, mapped_pool, _doc_pun, pun)
        out.append(_finalize(
            doc, "cmp", "punishment",
            f"Under the new law, what punishment does BNS {sec} ('{title}', formerly IPC {ipc}) prescribe?",
            pun, pun_pool,
            f"BNS {sec} (formerly IPC {ipc}) prescribes: {pun}. {summary}",
        ))

    return [q for q in out if q]


# ══════════════════════════════════════════════════════════════════════════════
# Bank builder + cache — every buildable question for a (mode, chapter, section)
# ══════════════════════════════════════════════════════════════════════════════
_BANK_CACHE: dict = {}


def _filter_pool(pool: list, chapter: Optional[str], section: Optional[str]) -> list:
    if section:
        docs = [d for d in pool if str(d.get("section_number")) == str(section)]
        if docs:
            # Focused quiz: the chosen section plus its chapter siblings for volume.
            ch = docs[0].get("chapter")
            siblings = [d for d in pool if d.get("chapter") == ch and d is not docs[0]]
            return docs + siblings
    if chapter:
        docs = [d for d in pool if (d.get("chapter") or "").strip() == chapter.strip()]
        if docs:
            return docs
    return pool


def _build_bank(mode: str, chapter: Optional[str], section: Optional[str]) -> list:
    bns, ipc = _get_bns(), _get_ipc()
    mapped = [d for d in bns if str(d.get("ipc_section") or "").strip()]
    bank: list = []

    if mode == "ipc_only":
        for doc in _filter_pool(ipc, chapter, section):
            bank.extend(_ipc_questions(doc, ipc))
    elif mode == "bns_only":
        for doc in _filter_pool(bns, chapter, section):
            bank.extend(_bns_questions(doc, bns))
    elif mode == "enriched_only":
        for doc in _filter_pool(mapped, chapter, section):
            bank.extend(_compare_questions(doc, mapped))
    else:  # mixed — both laws plus cross-reference
        for doc in _filter_pool(bns, chapter, section):
            bank.extend(_bns_questions(doc, bns))
        for doc in _filter_pool(ipc, chapter, section):
            bank.extend(_ipc_questions(doc, ipc))
        for doc in _filter_pool(mapped, chapter, section):
            bank.extend(_compare_questions(doc, mapped))

    return bank


def _get_bank(mode: str, chapter: Optional[str], section: Optional[str]) -> list:
    key = f"{mode}::{chapter or ''}::{section or ''}"
    cached = _BANK_CACHE.get(key)
    if cached and (_time.monotonic() - cached[1]) < _CACHE_TTL:
        return cached[0]
    bank = _build_bank(mode, chapter, section)
    _BANK_CACHE[key] = (bank, _time.monotonic())
    return bank


# ══════════════════════════════════════════════════════════════════════════════
# Routes
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/quiz/topics")
@limiter.limit("60/minute")
def quiz_topics(request: Request, law: str = "bns_only"):
    """
    The REAL chapters of the chosen law, straight from the dataset, in
    legislative order. The frontend renders these as topic cards.
    """
    if law == "ipc_only":
        pool = _get_ipc()
    elif law == "enriched_only":
        pool = [d for d in _get_bns() if str(d.get("ipc_section") or "").strip()]
    else:
        law = "bns_only"
        pool = _get_bns()

    chapters: dict = {}
    for d in pool:
        ch = (d.get("chapter") or "General").strip()
        entry = chapters.setdefault(ch, {"count": 0, "punishable": 0})
        entry["count"] += 1
        if _doc_pun(d):
            entry["punishable"] += 1

    topics = []
    for ch_name in sorted(chapters, key=_chapter_sort_key):
        roman, label = _chapter_parts(ch_name)
        topics.append({
            "key":        ch_name,
            "label":      label,
            "roman":      roman,
            "count":      chapters[ch_name]["count"],
            "punishable": chapters[ch_name]["punishable"],
        })

    return {"law": law, "total_sections": len(pool), "topics": topics}


@router.get("/quiz/generate")
@limiter.limit("30/minute")
def generate_quiz(
    request: Request,
    count: int = 10,
    category: Optional[str] = None,   # exact chapter name from /quiz/topics
    section: Optional[str] = None,    # focus on one section (LearningHub)
    title: Optional[str] = None,      # accepted for compatibility, unused
    mode: Optional[str] = "mixed",
    exclude_ids: Optional[str] = "",  # "id::qtype,…" already-seen keys
):
    """
    Sample `count` MCQs from the full dataset-grounded question bank,
    skipping keys in `exclude_ids` so questions don't repeat across sessions.
    """
    count = max(1, min(count, 25))
    excluded = {k.strip() for k in (exclude_ids or "").split(",") if k.strip()}

    try:
        bank = _get_bank(mode or "mixed", category, section)
    except Exception as e:
        print(f"[ERROR] Quiz bank build failed (mode={mode}, category={category}): {e}")
        return {"total": 0, "questions": []}

    if not bank:
        return {"total": 0, "questions": []}

    available = [q for q in bank if f"{q['id']}::{q['q_type']}" not in excluded]
    if len(available) < count:          # everything seen → start a fresh cycle
        available = list(bank)

    random.shuffle(available)

    # At most one question per section per quiz — spread across the chapter.
    questions, used_ids = [], set()
    for q in available:
        if q["id"] in used_ids:
            continue
        used_ids.add(q["id"])
        questions.append(q)
        if len(questions) == count:
            break
    for q in available:                 # top-up if pool of sections was small
        if len(questions) == count:
            break
        if q not in questions:
            questions.append(q)

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
