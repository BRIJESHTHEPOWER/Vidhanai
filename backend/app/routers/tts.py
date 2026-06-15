"""
TTS router — Kokoro-powered local text-to-speech.

  GET  /tts/voices  — list available voices + engine status
  POST /tts/speak   — synthesize text -> audio/wav
"""
import io
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.routers import sanitize_input
from app.services import tts as tts_service

router = APIRouter(prefix="/tts", tags=["TTS"])
limiter = Limiter(key_func=get_remote_address)

MAX_CHARS = 4000


class SpeakRequest(BaseModel):
    text:  str
    voice: Optional[str] = None
    speed: Optional[float] = 1.0


@router.get("/voices")
@limiter.limit("60/minute")
def get_voices(request: Request):
    """List available Kokoro voices and whether the engine is loaded."""
    return {
        "available": tts_service.is_available(),
        "default":   tts_service.DEFAULT_VOICE,
        "voices":    tts_service.list_voices(),
    }


@router.post("/speak")
@limiter.limit("30/minute")
def speak(request: Request, body: SpeakRequest):
    """Synthesize speech for arbitrary text and return a WAV file."""
    if not tts_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Kokoro TTS engine is not available on this server. "
                   "Install with `pip install kokoro soundfile` (and espeak-ng on Windows).",
        )

    text = sanitize_input(body.text, max_len=MAX_CHARS)
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")

    voice = body.voice or tts_service.DEFAULT_VOICE
    if voice not in tts_service.AVAILABLE_VOICES:
        voice = tts_service.DEFAULT_VOICE

    speed = body.speed or 1.0
    speed = max(0.5, min(2.0, speed))

    try:
        audio_bytes = tts_service.synthesize(text, voice=voice, speed=speed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {e}")

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=speech.wav"},
    )
