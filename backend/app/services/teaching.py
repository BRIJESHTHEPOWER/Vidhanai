"""
JD Teaching content generator — Groq-powered live-class persona.

JD is a passionate, warm Indian law professor giving a LIVE voice lesson.
Every line of output goes straight to Sarvam AI TTS, so it must be plain
spoken text — no markdown, no emojis, no symbols.
"""
import logging
import os

from groq import Groq
from app.services import sarvam_llm

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

# ── System prompts ────────────────────────────────────────────────────────────

_JD_LESSON_SYSTEM = """\
You are JD — a passionate, warm Indian law professor giving a LIVE voice lesson to a student.
You are speaking aloud, not writing. Make every word count.

Teaching structure (follow this EXACTLY, no deviations):
  HOOK        — One punchy opening line that makes the student WANT to learn this topic right now.
                e.g. "Did you know that India has a law that could send you to prison just for saying the wrong thing on WhatsApp?"
  WHAT        — Explain THOROUGHLY what THIS specific section actually does. Go part by part: define each
                important term the section uses, and state the ingredients that must ALL be present for it to
                apply. 4-6 sentences, in your own words. Never quote the legal text verbatim.
  WHY         — 2 sentences: why does this law exist? What real problem in society did it solve?
  EXAMPLE     — One vivid, relatable scenario set in modern India. Use realistic names (Ramesh, Priya, Vikram, Ayesha). Make it feel real.
  KEY POINT   — One final sentence the student must absolutely remember. Start it with "Remember this —" or "Here is what you must never forget —".

{mode_note}

Output rules — CRITICAL, no exceptions:
- PLAIN SPOKEN TEXT ONLY. No asterisks, dashes, bullets, numbering, headers, brackets, emojis. Nothing.
- No greeting of any kind. No "Hello", "Welcome", "Good morning", "Namaste". Start DIRECTLY with the HOOK.
- Do not ask any question at the end of your lesson. The system handles that.
- Clear sentences, natural pauses: "Now," "Listen," "Here is the key."
- 220 to 300 words total — enough to teach the section properly, well-paced for a voice lesson.
- {lang_note}
"""

_JD_INTRO_SYSTEM = """\
You are JD, a passionate Indian law professor about to start a live chapter.
Write a short, energetic spoken INTRODUCTION that:
  - Greets the student warmly by telling them what chapter they are about to study.
  - Tells them how many sections this chapter covers and briefly what to expect.
  - Ends by saying you are about to start the first section now.
  - 3 to 5 sentences. Plain spoken text only. No markdown, no emojis.
  - {lang_note}
"""

_JD_DOUBT_SYSTEM = """\
You are JD, an Indian law professor. A student asked you a question during the lesson.

{mode_note}

CRITICAL RULES — follow exactly:
1. Answer the question directly and helpfully. It is usually about the current section,
   but if the student asks a BROADER question about Indian law (any BNS/IPC section,
   rights, FIR, bail, courts, procedure, etc.), answer that too using your legal
   knowledge. NEVER refuse or say "that's outside this lesson" for a genuine legal question.
2. Be direct and conversational — like a knowledgeable friend answering quickly.
3. Keep it short: 2 to 3 sentences, roughly 45 to 60 words. If helpful, add ONE quick real-life example.
4. No greetings ("Great question!", "Sure!"). Go straight to the answer.
5. Plain spoken text only — no markdown, no bullets, no emojis.
6. Only if the question is truly non-legal (sports, movies, cooking, small talk),
   gently say you can help with any Indian-law topic and invite a legal question.
7. {lang_note}
"""

_JD_REEXPLAIN_SYSTEM = """\
You are JD, an Indian law professor. The student still doesn't understand — try a completely different angle.

{mode_note}

CRITICAL RULES:
1. Use a NEW analogy or example — never repeat what you already said.
2. Maximum 50 words, 2-3 sentences.
3. Plain spoken text only — no markdown, no emojis.
4. {lang_note}
"""

# ── Audience note — single unified style (former citizen/student modes merged) ─
# The learner may be a curious citizen OR a law student, so JD adapts in one
# breath: plain everyday explanation first, formal legal term named right after.
_UNIFIED_MODE_NOTE = (
    "Audience: anyone from a curious citizen to a law student. "
    "Explain every concept in plain everyday language FIRST, as if to a friend, "
    "then immediately name the formal legal term for it (e.g. '…taking something "
    "to wrongfully gain — lawyers call this dishonest intention'). "
    "Use real-world analogies. Where it truly helps, add ONE short line on how "
    "courts apply the point — never more, so a first-time reader is not overwhelmed."
)

_UNIFIED_DOUBT_NOTE = (
    "The person asking may be a regular citizen or a law student. "
    "Answer like a helpful neighbour who happens to know the law: everyday words first, "
    "then name the precise legal term in the same breath so they learn the vocabulary. "
    "If their question touches their own life, end with what they should practically DO "
    "(e.g. file an FIR, keep evidence, consult a lawyer); if it is about scope or "
    "applicability, point to the essential element that decides it — in one short line."
)

# ── Language notes ────────────────────────────────────────────────────────────
_NATIVE_SCRIPT = {
    "Hindi":     "हिन्दी",
    "Kannada":   "ಕನ್ನಡ",
    "Tamil":     "தமிழ்",
    "Telugu":    "తెలుగు",
    "Marathi":   "मराठी",
    "Malayalam": "മലയാളം",
}


def _lang_note(language: str) -> str:
    lang = (language or "English").strip()
    if lang.lower() == "english":
        return "Respond in clear, warm, conversational Indian English."

    native = _NATIVE_SCRIPT.get(lang, lang)
    return (
        f"LANGUAGE RULE — NON-NEGOTIABLE: Respond ENTIRELY in {lang} using {native} script. "
        f"EVERY sentence must be in {lang} ({native}). "
        f"Do NOT write anything in English except section numbers, law codes (BNS, IPC), and people's names. "
        f"Use simple, everyday spoken {lang} — not formal or literary vocabulary."
    )


def _client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not configured")
    return Groq(api_key=api_key)


def _is_indian(language: str) -> bool:
    return bool(language) and (language or "").strip().lower() != "english"


def _generate(system: str, user: str, temperature: float, max_tokens: int, language: str) -> str:
    """Language-routed text generation:
      • Indian languages → Sarvam AI (Sarvam-105b) — native-script quality
      • English          → Groq (Llama) — fast
    Sarvam failures fall back to Groq so the lesson never breaks."""
    return _generate_chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature, max_tokens, language,
    )


def _generate_chat(msgs: list, temperature: float, max_tokens: int, language: str) -> str:
    """Same routing as _generate but takes a full messages list (for doubts
    that carry conversation history)."""
    if _is_indian(language) and sarvam_llm.is_available():
        try:
            out = sarvam_llm.chat(msgs, temperature=temperature, max_tokens=max_tokens).strip()
            if out:
                return out
            # Sarvam sometimes returns an empty 200 — treat as failure, not content.
            logger.warning("[Teaching] Sarvam returned empty — falling back to Groq")
        except Exception as exc:
            logger.warning("[Teaching] Sarvam failed (%s) — falling back to Groq", exc)
    # English, or Sarvam unavailable/empty → Groq (fast; its plain-text mode
    # still handles native Indian scripts — only its JSON mode reverts to English).
    resp = _client().chat.completions.create(
        model=GROQ_MODEL, messages=msgs, temperature=temperature, max_tokens=max_tokens,
    )
    return (resp.choices[0].message.content or "").strip()


# ── Public API ─────────────────────────────────────────────────────────────────

def generate_chapter_intro(
    law_code: str,
    chapter_name: str,
    section_titles: list,
    language: str = "English",
) -> str:
    """
    Short spoken chapter introduction JD delivers before the first section.
    Warm, energetic, sets expectations.
    """
    titles_preview = ", ".join(section_titles[:5])
    if len(section_titles) > 5:
        titles_preview += f", and {len(section_titles) - 5} more topics"

    system = _JD_INTRO_SYSTEM.format(lang_note=_lang_note(language))
    user = (
        f"Law: {law_code}\n"
        f"Chapter: {chapter_name}\n"
        f"Number of sections: {len(section_titles)}\n"
        f"Topics at a glance: {titles_preview}\n\n"
        "Write the chapter introduction now."
    )

    try:
        # Indian languages → Sarvam (native script); English → Groq (fast).
        return _generate(system, user, temperature=0.7, max_tokens=220, language=language)
    except Exception as exc:
        logger.error("[Teaching] Chapter intro failed: %s", exc)
        return (
            f"Welcome to {chapter_name}. "
            f"We have {len(section_titles)} sections ahead of us. "
            "Let us begin right away with the first topic."
        )


def generate_teaching_script(
    law_code: str,
    section_number: str,
    section_title: str,
    section_text: str,
    punishment: str = "",
    mode: str = "student",
    language: str = "English",
    append_end_prompt: bool = True,
) -> str:
    """
    Full spoken lesson for ONE law section.
    Structure: Hook → What → Why → Example → Key Point.
    Optionally appends the end-of-topic prompt.
    """
    mode_note = _UNIFIED_MODE_NOTE
    system = _JD_LESSON_SYSTEM.format(
        mode_note=mode_note,
        lang_note=_lang_note(language),
    )

    pun_line = f"\nPunishment: {punishment}" if punishment and punishment.strip() else ""
    user = (
        f"Law: {law_code}\n"
        f"Section {section_number}: {section_title}\n"
        f"Full legal text (teach THIS section in depth, part by part): {section_text[:2200]}"
        f"{pun_line}\n\n"
        "Teach this section now using the HOOK → WHAT → WHY → EXAMPLE → KEY POINT structure."
    )

    try:
        # Indian languages → Sarvam (native script); English → Groq (fast).
        lesson = _generate(system, user, temperature=0.55, max_tokens=900, language=language)
    except Exception as exc:
        logger.error("[Teaching] Lesson generation failed: %s", exc)
        lesson = (
            f"Let us look at {law_code} Section {section_number}, {section_title}. "
            f"{section_text[:400]}"
        )

    if append_end_prompt:
        end = _end_of_topic_prompt(language)
        lesson = f"{lesson}\n\n{end}"

    return lesson


def generate_doubt_answer(
    law_code: str,
    section_number: str,
    section_title: str,
    section_text: str,
    question: str,
    history: list = None,
    language: str = "English",
    ask_clear: bool = True,
    reexplain: bool = False,
    mode: str = "student",
) -> str:
    """
    Answer a student's in-lesson doubt.
    `reexplain=True` uses a different approach when the student says "not clear".
    `mode` shapes the answer's register: citizen (plain + practical), student
    (elements + terminology), exam (precise + exam-focused).
    """
    system_template = _JD_REEXPLAIN_SYSTEM if reexplain else _JD_DOUBT_SYSTEM
    system = system_template.format(
        mode_note=_UNIFIED_DOUBT_NOTE,
        lang_note=_lang_note(language),
    )

    msgs = [{"role": "system", "content": system}]
    for role, text in (history or [])[-6:]:
        msgs.append({"role": "user" if role == "user" else "assistant", "content": text})

    context = (
        f"[Currently teaching: {law_code} Section {section_number} — {section_title}]\n"
        f"[Section text (excerpt): {section_text[:600]}]\n\n"
        f"Student question: {question}"
    )
    msgs.append({"role": "user", "content": context})

    try:
        # Indian languages → Sarvam (native script); English → Groq (fast).
        answer = _generate_chat(msgs, temperature=0.45, max_tokens=220, language=language)
    except Exception as exc:
        logger.error("[Teaching] Doubt answer failed: %s", exc)
        answer = "I am having a small technical issue. Could you please repeat your question?"

    # Ensure "Is your doubt clear now?" is always present
    clarity_check = "Is your doubt clear now?"
    if ask_clear and clarity_check not in answer:
        answer = f"{answer}\n\n{clarity_check}"

    return answer


def _end_of_topic_prompt(language: str) -> str:
    """Language-aware prompt JD speaks after finishing a section."""
    lang = (language or "English").strip()
    prompts = {
        "English":   "Do you have any doubts about this topic, or shall we move to the next section?",
        "Hindi":     "Kya is topic par koi doubt hai, ya hum next section par chalein?",
        "Kannada":   "Ee vishayada bagge yenavadu sandehagaliveyaa, illa mundina vibhagakke hogalama?",
        "Tamil":     "Inthath thalaippatril enna santhegam irukkirathaa, illa aduttha paakathirkku selvomaa?",
        "Telugu":    "Ee vishayamlo meeku ela sandehalu unnaya, lekapote tarvata vibhagaaniki velthaamaaa?",
        "Marathi":   "Ya vishayavar kahi shanka aahe ka, kinkva aapalyala pudhachya vibhaagat jaayacha aahe ka?",
        "Malayalam": "Ee vishayatthil valla sandeham unDo, athallengil aduttha vibhaagatthilekku pokaamo?",
    }
    return prompts.get(lang, prompts["English"])
