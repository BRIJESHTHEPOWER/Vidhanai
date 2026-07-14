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
  models: sarvam-105b (used here), sarvam-30b
"""
import os
import logging

import requests

logger = logging.getLogger(__name__)

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"
MODEL           = "sarvam-105b"


def get_api_key() -> str:
    return os.environ.get("SARVAM_API_KEY", "").strip()


def is_available() -> bool:
    key = get_api_key()
    return bool(key) and key != "your_sarvam_api_key_here"


def chat(messages: list, temperature: float = 0.45, max_tokens: int = 1200) -> str:
    """Run a chat completion through Sarvam-105b. `messages` is the usual
    [{role, content}, ...] list. Returns the assistant text ('' on failure —
    callers decide how to fall back)."""
    key = get_api_key()
    if not key:
        raise RuntimeError("SARVAM_API_KEY is not set")

    body = {
        "model":       MODEL,
        "messages":    messages,
        "temperature": temperature,
        "max_tokens":  max_tokens,
    }
    headers = {
        "api-subscription-key": key,
        "Content-Type":         "application/json",
    }
    resp = requests.post(SARVAM_CHAT_URL, json=body, headers=headers, timeout=90)
    if not resp.ok:
        raise RuntimeError(f"Sarvam LLM error {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    return (data.get("choices", [{}])[0].get("message", {}).get("content", "") or "").strip()


def generate_text(system: str, user: str, temperature: float = 0.45, max_tokens: int = 1200) -> str:
    """Convenience wrapper: system + single user message → assistant text."""
    return chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
