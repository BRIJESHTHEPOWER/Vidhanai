"""
TTS router — Sarvam AI text-to-speech.

  GET  /tts/voices   — list available Sarvam speakers + status
  GET  /tts/engines  — whether Sarvam is ready
  POST /tts/speak    — synthesize text → audio/wav

JD's voice is always Sarvam AI (bulbul:v2), for both English and Indian
languages. Requires SARVAM_API_KEY.
"""
import hashlib
import io
from collections import OrderedDict
from threading import Lock
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.routers import sanitize_input
from app.services import sarvam_tts as sarvam_service
from app.services.plan_gate import require_pro

# Sarvam TTS powers Pro-only features (JD voice, Law Tutor) — requires Pro.
router  = APIRouter(prefix="/tts", tags=["TTS"], dependencies=[Depends(require_pro)])
limiter = Limiter(key_func=get_remote_address)

MAX_CHARS = 4000

# ── In-memory WAV cache ───────────────────────────────────────────────────────
# JD repeats the same short phrases constantly ("Any more doubts?", checkpoint
# feedback, chapter prompts …). Caching synthesized WAVs makes those replies
# INSTANT instead of a fresh 1-3 s Sarvam round-trip every time.
# LRU, byte-capped. Only short texts are cached — long lesson scripts are
# unique per section, so caching them would just churn the cache.
_CACHE_MAX_BYTES = 48 * 1024 * 1024   # 48 MB total
_CACHE_MAX_TEXT  = 500                # only cache texts ≤ this many chars
_tts_cache: "OrderedDict[str, bytes]" = OrderedDict()
_tts_cache_bytes = 0
_tts_cache_lock  = Lock()


def _cache_key(*parts) -> str:
    return hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()


def _cache_get(key: str):
    with _tts_cache_lock:
        data = _tts_cache.get(key)
        if data is not None:
            _tts_cache.move_to_end(key)
        return data


def _cache_put(key: str, data: bytes) -> None:
    global _tts_cache_bytes
    if not data or len(data) > _CACHE_MAX_BYTES // 8:
        return
    with _tts_cache_lock:
        old = _tts_cache.pop(key, None)
        if old is not None:
            _tts_cache_bytes -= len(old)
        _tts_cache[key] = data
        _tts_cache_bytes += len(data)
        while _tts_cache_bytes > _CACHE_MAX_BYTES and _tts_cache:
            _, evicted = _tts_cache.popitem(last=False)
            _tts_cache_bytes -= len(evicted)

# BCP-47 code → language name (for callers that pass 'hi-IN' instead of 'Hindi')
_CODE_TO_LANG: dict[str, str] = {v: k for k, v in sarvam_service.LANG_CODE_MAP.items()}


class SpeakRequest(BaseModel):
    text:     str
    speed:    Optional[float] = 1.0
    language: Optional[str]   = "English"  # language name OR BCP-47 code
    speaker:  Optional[str]   = None       # Sarvam speaker (e.g. "anushka")
    engine:   Optional[str]   = None       # kept for compatibility; always Sarvam now


@router.get("/voices")
@limiter.limit("60/minute")
def get_voices(request: Request):
    return {
        "sarvam": {
            "available":      sarvam_service.is_available(),
            "model":          sarvam_service.MODEL,
            "default_speaker": sarvam_service.DEFAULT_SPEAKER,
            "speakers":       sarvam_service.AVAILABLE_SPEAKERS,
            "languages":      list(sarvam_service.LANG_CODE_MAP.keys()),
        },
    }


@router.get("/engines")
@limiter.limit("60/minute")
def get_engines(request: Request):
    return {
        "sarvam_ready":   sarvam_service.is_available(),
        "sarvam_key_set": bool(sarvam_service.get_api_key()),
    }


@router.post("/speak")
@limiter.limit("180/minute")
def speak(request: Request, body: SpeakRequest):
    """Synthesize speech → WAV via Sarvam AI (bulbul:v2), for every language
    including English. Requires SARVAM_API_KEY."""
    text = sanitize_input(body.text, max_len=MAX_CHARS)
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")

    if not sarvam_service.is_available():
        raise HTTPException(
            status_code=503,
            detail=(
                "Sarvam AI is not configured. Add SARVAM_API_KEY to backend/.env "
                "to enable voice. Get your key at https://app.sarvam.ai/"
            ),
        )

    # Normalise language: accept both "Hindi" and "hi-IN"
    raw_lang = (body.language or "English").strip()
    language = _CODE_TO_LANG.get(raw_lang, raw_lang)  # "hi-IN" → "Hindi", pass-through if already a name

    speaker  = body.speaker or sarvam_service.DEFAULT_SPEAKER
    loudness = sarvam_service.TEACHING_LOUDNESS
    # English reads more clearly at a natural pace; the slower classroom pace is
    # kept for Indian scripts where deliberate delivery aids comprehension.
    is_english = language.strip().lower() == "english"
    pace = sarvam_service.ENGLISH_PACE if is_english else sarvam_service.TEACHING_PACE

    cache_key = None
    if len(text) <= _CACHE_MAX_TEXT:
        cache_key = _cache_key("sarvam", language, speaker, pace, loudness, text)
        cached = _cache_get(cache_key)
        if cached is not None:
            return StreamingResponse(
                io.BytesIO(cached),
                media_type="audio/wav",
                headers={"Content-Disposition": "inline; filename=speech.wav",
                         "X-TTS-Cache": "hit"},
            )

    try:
        audio_bytes = sarvam_service.synthesize(
            text, language=language, speaker=speaker, pace=pace, loudness=loudness,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if cache_key:
        _cache_put(cache_key, audio_bytes)

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )
