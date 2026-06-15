"""
Kokoro TTS service — fully local, offline neural text-to-speech.

- No external TTS providers (no ElevenLabs, no Google/Azure/AWS TTS).
- No paid services, no API keys for voice generation.
- Runs the open-source Kokoro-82M model locally via the `kokoro` pip package.

One-time setup:
    pip install kokoro soundfile
    (Windows) install espeak-ng and make sure it's on PATH —
    misaki (Kokoro's G2P) uses it for English phonemization:
    https://github.com/espeak-ng/espeak-ng/releases

The Kokoro pipeline + voicepacks are downloaded once from Hugging Face on
first use and cached locally afterwards — fully offline after that.

Default voice: af_sarah (warm female American-English voice — teacher-like).
"""
import io
import logging
import re
import threading

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

SAMPLE_RATE   = 24000
LANG_CODE     = "a"          # American English
DEFAULT_VOICE = "af_sarah"

# Known American-English voicepacks shipped with Kokoro-82M.
# af_* = female, am_* = male.
AVAILABLE_VOICES = [
    "af_sarah", "af_heart", "af_bella", "af_nicole", "af_sky",
    "af_alloy", "af_aoede", "af_jessica", "af_kore", "af_nova", "af_river",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
    "am_michael", "am_onyx", "am_puck",
]

# Tried in order if the requested voice fails to load.
_FALLBACK_ORDER = ["af_sarah", "af_heart", "af_bella", "af_nicole"]

_pipeline = None
_pipeline_lock = threading.Lock()


def _get_pipeline():
    """Lazily load the Kokoro pipeline (singleton). Returns False if unavailable."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline
        try:
            from kokoro import KPipeline
            _pipeline = KPipeline(lang_code=LANG_CODE)
            logger.info("[TTS] Kokoro pipeline loaded (lang_code=%s)", LANG_CODE)
        except Exception as e:
            logger.error(
                "[TTS] Kokoro pipeline failed to load — TTS endpoints will return 503. "
                "Install with `pip install kokoro soundfile` (+ espeak-ng on Windows). Error: %s",
                e,
            )
            _pipeline = False
    return _pipeline


def is_available() -> bool:
    """True if the Kokoro engine loaded successfully."""
    return _get_pipeline() is not False


def list_voices() -> list:
    return list(AVAILABLE_VOICES)


# ── Text cleanup ────────────────────────────────────────────────────────────
_MD_BOLD_RE   = re.compile(r"\*\*(.*?)\*\*")
_MD_HEADER_RE = re.compile(r"^#{1,6}\s*", re.MULTILINE)
_EMOJI_RE     = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]+",
    flags=re.UNICODE,
)
_WS_RE = re.compile(r"[ \t]+")


def clean_for_speech(text: str) -> str:
    """Strip markdown/emoji noise so Kokoro doesn't try to pronounce symbols."""
    if not text:
        return ""
    cleaned = _MD_BOLD_RE.sub(r"\1", text)
    cleaned = _MD_HEADER_RE.sub("", cleaned)
    cleaned = _EMOJI_RE.sub("", cleaned)
    cleaned = cleaned.replace("*", "").replace("#", "")
    cleaned = _WS_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


# ── Synthesis ─────────────────────────────────────────────────────────────────
def _run_pipeline(pipeline, text: str, voice: str, speed: float):
    chunks = []
    generator = pipeline(text, voice=voice, speed=speed, split_pattern=r"\n+")
    for _, _, audio in generator:
        arr = audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio)
        chunks.append(arr)
    return chunks


def synthesize(text: str, voice: str = DEFAULT_VOICE, speed: float = 1.0) -> bytes:
    """
    Generate speech for `text` and return a WAV file as bytes (24kHz mono PCM).
    Raises RuntimeError if Kokoro isn't installed/loaded, ValueError on bad input.
    """
    pipeline = _get_pipeline()
    if pipeline is False:
        raise RuntimeError(
            "Kokoro TTS engine is not available on this server. "
            "Install with `pip install kokoro soundfile` (and espeak-ng on Windows)."
        )

    text = clean_for_speech(text)
    if not text:
        raise ValueError("Empty text after cleanup")

    speed = speed or 1.0
    chosen_voice = voice or DEFAULT_VOICE

    try:
        chunks = _run_pipeline(pipeline, text, chosen_voice, speed)
    except Exception as e:
        logger.warning("[TTS] Voice '%s' failed (%s) — trying fallback voices", chosen_voice, e)
        chunks = []
        for fb in _FALLBACK_ORDER:
            if fb == chosen_voice:
                continue
            try:
                chunks = _run_pipeline(pipeline, text, fb, speed)
                if chunks:
                    break
            except Exception:
                continue
        if not chunks:
            raise RuntimeError(f"Kokoro TTS generation failed for all voices: {e}")

    if not chunks:
        raise RuntimeError("Kokoro produced no audio output")

    full_audio = np.concatenate(chunks)
    buf = io.BytesIO()
    sf.write(buf, full_audio, SAMPLE_RATE, format="WAV")
    buf.seek(0)
    return buf.read()
