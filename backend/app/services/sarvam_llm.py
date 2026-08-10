"""
Sarvam AI LLM service — Sarvam-105b chat completions.

Sarvam's own LLM is used for the Law Tutor's CONTENT generation (lessons,
spoken teaching scripts, chapter greetings, doubt answers). It is purpose-built
for Indian languages, so unlike Llama/Groq it reliably writes Tamil, Kannada,
Telugu, Malayalam, Marathi and Hindi in native script — including inside JSON.

Same SARVAM_API_KEY as the TTS service (app/services/sarvam_tts.py). This module
only adds the chat/LLM endpoint; it does not touch TTS.

API: OpenAI-compatible chat completions
  POST https://api.sarvam.ai/v1/chat/completions
  header: api-subscription-key
"""
import os
import logging

import requests

logger = logging.getLogger(__name__)

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"

# Two Sarvam models, chosen by what the caller needs:
#
#   • sarvam-105b — a REASONING model. It spends output tokens on a hidden chain
#     of thought (returned as `reasoning_content`) BEFORE it writes a single
#     character of `content`. That thinking alone runs to a few thousand tokens,
#     so a small max_tokens returns content=None with finish_reason="length" —
#     silently empty, not an error. Only use it where the budget is in the
#     thousands (the structured lesson JSON), and always with reasoning_effort
#     set so more of the budget is left for the actual answer.
#
#   • sarvam-105b-conversations — no reasoning step. Answers immediately (~5s
#     instead of ~30s) and never eats its own budget. This is the ONLY safe
#     model for short spoken replies: doubts, chapter intros, teaching scripts.
#
# (sarvam-30b is deprecated upstream and now returns 400.)
MODEL_REASONING = "sarvam-105b"
MODEL_CHAT      = "sarvam-105b-conversations"
MODEL           = MODEL_REASONING   # back-compat alias

# Per-model output ceilings on the "starter" subscription tier. Going over is a
# hard 400 ("max_tokens exceeds the maximum allowed … for your subscription
# tier"), which is how every lesson request used to fail, so requests are
# clamped here instead of being left to blow up at each call site.
MAX_OUTPUT_TOKENS = {
    MODEL_REASONING: 4096,
    MODEL_CHAT:      2048,
}


def get_api_key() -> str:
    return os.environ.get("SARVAM_API_KEY", "").strip()


def is_available() -> bool:
    key = get_api_key()
    return bool(key) and key != "your_sarvam_api_key_here"


def chat(
    messages: list,
    temperature: float = 0.45,
    max_tokens: int = 1200,
    model: str = MODEL_CHAT,
    reasoning_effort: str | None = None,
) -> str:
    """Run a chat completion through Sarvam. `messages` is the usual
    [{role, content}, ...] list. Returns the assistant text, and RAISES on any
    failure — including a 200 that carries no usable content — so callers fall
    back to another provider instead of teaching an empty lesson.

    `reasoning_effort` ("low" | "medium" | "high") only applies to
    MODEL_REASONING; it is ignored by the conversations model."""
    key = get_api_key()
    if not key:
        raise RuntimeError("SARVAM_API_KEY is not set")

    cap = MAX_OUTPUT_TOKENS.get(model)
    if cap and max_tokens > cap:
        logger.debug("[Sarvam] clamping max_tokens %s → %s for %s", max_tokens, cap, model)
        max_tokens = cap

    body = {
        "model":       model,
        "messages":    messages,
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    if reasoning_effort:
        body["reasoning_effort"] = reasoning_effort
    headers = {
        "api-subscription-key": key,
        "Content-Type":         "application/json",
    }
    resp = requests.post(SARVAM_CHAT_URL, json=body, headers=headers, timeout=90)
    if not resp.ok:
        raise RuntimeError(f"Sarvam LLM error {resp.status_code}: {resp.text[:300]}")

    data    = resp.json()
    choice  = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = (message.get("content") or "").strip()
    if content:
        return content

    # A 200 with no content. On the reasoning model this means the whole output
    # budget went into `reasoning_content` before it began the answer — the
    # failure mode that made every Sarvam tutor reply come back blank.
    if message.get("reasoning_content"):
        raise RuntimeError(
            f"Sarvam {model} used its whole {max_tokens}-token budget reasoning "
            f"(finish_reason={choice.get('finish_reason')}) and wrote no answer — "
            f"raise max_tokens or use MODEL_CHAT"
        )
    raise RuntimeError(
        f"Sarvam {model} returned empty content (finish_reason={choice.get('finish_reason')})"
    )


def generate_text(
    system: str,
    user: str,
    temperature: float = 0.45,
    max_tokens: int = 1200,
    model: str = MODEL_CHAT,
    reasoning_effort: str | None = None,
) -> str:
    """Convenience wrapper: system + single user message → assistant text."""
    return chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens,
        model=model,
        reasoning_effort=reasoning_effort,
    )
