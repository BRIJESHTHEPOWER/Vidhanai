"""
JD Teaching content generator — Groq-powered.

Turns raw BNS/IPC section text from the legal dataset into a spoken,
classroom-style lesson ("JD" persona), and answers in-lesson doubts.
Output is plain spoken text (no markdown/emojis) so it can be sent
directly to Kokoro TTS.
"""
import logging
import os

from groq import Groq

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

END_OF_TOPIC_PROMPT = (
    "Do you have any doubts regarding this topic, or shall we continue to the next topic?"
)

_JD_TEACHING_SYSTEM = """You are JD, a warm, encouraging Indian law professor speaking ALOUD to a student.

Your teaching rules:
- Teach the ONE section given to you — fully, never skip it or say it is "not covered".
- Begin by naming what this is in one short opening line, e.g. "This is the {law_code} definition of <topic>." or "This is the {law_code} provision on <topic>." Then immediately explain what it MEANS in your own simple words.
- Explain the law in simple, everyday language a beginner can follow — do NOT just read the legal text aloud.
- Explain WHY this law exists / what real-world problem it solves.
- Give ONE short, concrete practical example (a relatable Indian scenario with a named person).
- Sound like a real professor talking to a student — warm, clear, conversational.

Output rules (CRITICAL — this text is fed directly to a text-to-speech engine):
- Output PLAIN SPOKEN TEXT ONLY. No markdown, no asterisks, no headers, no bullet points, no emojis.
- Do NOT use a greeting like "Welcome" or "Hello" — go straight into the lesson with the opening line above.
- Do not say "Section X states that..." word-for-word from the legal text — explain it in your own words.
- Do NOT ask the student any questions at the end — the system will ask separately.
- Keep it focused: about 130-220 words.
- {mode_note}
- {lang_note}
"""

_MODE_NOTES = {
    "citizen": "Use very simple, everyday language with zero legal jargon — explain it like you would to a friend with no legal background.",
    "student": "Use correct legal terminology but explain every term simply — suitable for a law student.",
    "exam":    "Emphasize the points most likely to appear in an exam — definitions, punishments, and key distinctions.",
}


def _client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not configured")
    return Groq(api_key=api_key)


def _lang_note(language: str) -> str:
    if language and language.lower() != "english":
        return f"Respond entirely in {language}."
    return "Respond in English."


def generate_chapter_intro(law_code: str, chapter_name: str, section_titles: list, language: str = "English") -> str:
    """Short spoken intro when a chapter/lesson session starts."""
    titles = ", ".join(section_titles[:6])
    more = f", and {len(section_titles) - 6} more" if len(section_titles) > 6 else ""

    system = (
        "You are JD, a warm Indian law professor giving a short spoken introduction "
        "to a new chapter, before teaching section by section. "
        "Output PLAIN SPOKEN TEXT only — no markdown, no emojis, 2-4 sentences. "
        f"{_lang_note(language)}"
    )
    user = (
        f"Law: {law_code}\nChapter: {chapter_name}\n"
        f"Sections to be covered: {titles}{more}\n\n"
        "Write a short, friendly spoken introduction to this chapter."
    )

    try:
        completion = _client().chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.6,
            max_tokens=200,
        )
        return (completion.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("[Teaching] Chapter intro failed: %s", e)
        return f"Welcome to {chapter_name}. Let's begin with the first section."


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
    """Generate the spoken lesson for one law section."""
    mode_note = _MODE_NOTES.get(mode, _MODE_NOTES["student"])
    system = _JD_TEACHING_SYSTEM.format(
        law_code=law_code, mode_note=mode_note, lang_note=_lang_note(language)
    )

    user = (
        f"Law: {law_code} | Section {section_number}: {section_title}\n"
        f"Legal text: {section_text[:1000]}\n"
        f"Punishment: {punishment or 'N/A'}\n\n"
        "Teach this section now."
    )

    try:
        completion = _client().chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.5,
            max_tokens=500,
        )
        lesson = (completion.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("[Teaching] Lesson generation failed: %s", e)
        lesson = (
            f"Let's look at {law_code} Section {section_number}, {section_title}. "
            f"{section_text[:400]}"
        )

    if append_end_prompt:
        lesson = f"{lesson}\n\n{END_OF_TOPIC_PROMPT}"

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
) -> str:
    """Answer a student's interruption/doubt about the section currently being taught."""
    system = (
        "You are JD, a friendly Indian law professor. The student just interrupted your lesson "
        "with a question. Answer it clearly in 2-4 spoken sentences, relate it back to the "
        "section being taught when possible. "
        "Output PLAIN SPOKEN TEXT only — no markdown, no emojis. "
        f"{_lang_note(language)}"
    )

    msgs = [{"role": "system", "content": system}]
    for role, text in (history or [])[-6:]:
        msgs.append({"role": "user" if role == "user" else "assistant", "content": text})

    context = (
        f"[Currently teaching: {law_code} Section {section_number} — {section_title}]\n"
        f"[Section text: {section_text[:500]}]\n\n"
        f"Student's question: {question}"
    )
    msgs.append({"role": "user", "content": context})

    try:
        completion = _client().chat.completions.create(
            model=GROQ_MODEL,
            messages=msgs,
            temperature=0.5,
            max_tokens=350,
        )
        answer = (completion.choices[0].message.content or "").strip()
    except Exception as e:
        logger.error("[Teaching] Doubt answer failed: %s", e)
        answer = "I'm having a little trouble answering that right now. Could you try asking again?"

    if ask_clear:
        answer = f"{answer}\n\nIs your doubt clear now?"

    return answer
