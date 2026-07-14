"""
Sarvam AI TTS service  —  bulbul:v2 model.

API reference: https://docs.sarvam.ai/api-reference-docs/text-to-speech

Key facts about the v2 API
  • Endpoint  : POST https://api.sarvam.ai/text-to-speech
  • Auth       : api-subscription-key header
  • Input field: "text" (single string, max ~1 500 chars)  ← NOT "inputs"
  • Model      : "bulbul:v2"   (v1 is deprecated and returns 422)
  • Speakers   : anushka · manisha · vidya · arya (f)
                 abhilash · karun · hitesh (m)
  • pace       : 0.3 – 3.0   (default 1.0)
  • pitch      : -0.75 – 0.75 (default 0.0)
  • loudness   : 0.3 – 3.0   (default 1.0)
  • Response   : { "audios": ["<base64 WAV>"], "request_id": "..." }

For text longer than 1 400 chars we split at sentence / paragraph boundaries
and make one API call per chunk, then concatenate the WAV files gaplessly.
"""
import base64
import io
import logging
import os
import re
import wave
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

logger = logging.getLogger(__name__)

# ── Endpoint + model ─────────────────────────────────────────────────────────
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
MODEL          = "bulbul:v2"

# ── Language map ─────────────────────────────────────────────────────────────
LANG_CODE_MAP: dict[str, str] = {
    "English":   "en-IN",
    "Hindi":     "hi-IN",
    "Kannada":   "kn-IN",
    "Tamil":     "ta-IN",
    "Telugu":    "te-IN",
    "Marathi":   "mr-IN",
    "Malayalam": "ml-IN",
    "Bengali":   "bn-IN",
    "Gujarati":  "gu-IN",
    "Punjabi":   "pa-IN",
}

INDIAN_LANGUAGES = {k for k in LANG_CODE_MAP if k != "English"}

# ── Speakers (bulbul:v2) ──────────────────────────────────────────────────────
DEFAULT_SPEAKER    = "anushka"          # warm female, good for teaching
AVAILABLE_SPEAKERS = [
    "anushka", "manisha", "vidya", "arya",          # female
    "abhilash", "karun", "hitesh",                  # male
]

# ── Teaching defaults ─────────────────────────────────────────────────────────
TEACHING_PACE     = 0.82    # slightly slower than normal — clear classroom delivery (Indian scripts)
ENGLISH_PACE      = 1.0     # natural pace for English — slower paces distort English pronunciation
TEACHING_LOUDNESS = 1.5     # slightly louder for clear classroom delivery
TEACHING_PITCH    = 0.0

# v2 max is ~1 500 chars.  We stay well under with 1 300 so even multi-byte
# Unicode text (Hindi, Tamil …) never exceeds the byte limit.
_CHUNK_MAX = 1300

# ── Text cleanup regexes ──────────────────────────────────────────────────────
_MD_BOLD = re.compile(r"\*\*(.*?)\*\*")
_MD_HEAD = re.compile(r"^#{1,6}\s*", re.MULTILINE)
_EMOJI   = re.compile(
    r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]+",
    flags=re.UNICODE,
)
_PARA_RE = re.compile(r"\n\n+")
_SENT_RE = re.compile(r"(?<=[.!?।])\s+")


# ── Public helpers ────────────────────────────────────────────────────────────

def get_api_key() -> str:
    return os.environ.get("SARVAM_API_KEY", "").strip()


def is_available() -> bool:
    """True when a real (non-placeholder) Sarvam API key is set."""
    key = get_api_key()
    return bool(key) and key != "your_sarvam_api_key_here"


def clean_for_speech(text: str) -> str:
    """Strip markdown / emoji before sending to Sarvam."""
    if not text:
        return ""
    text = _MD_BOLD.sub(r"\1", text)
    text = _MD_HEAD.sub("", text)
    text = _EMOJI.sub("", text)
    text = text.replace("*", "").replace("#", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Internal: split + concatenate ─────────────────────────────────────────────

def _split_chunks(text: str) -> list[str]:
    """
    Split `text` into chunks ≤ _CHUNK_MAX chars at natural boundaries
    (paragraph → sentence → hard-cut).  Returns a non-empty list.
    """
    paragraphs = [p.strip() for p in _PARA_RE.split(text) if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    sentences: list[str] = []
    for para in paragraphs:
        if len(para) <= _CHUNK_MAX:
            sentences.append(para)
        else:
            for part in _SENT_RE.split(para):
                part = part.strip()
                if part:
                    sentences.append(part)

    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if not sent:
            continue
        joiner = " " if current else ""
        if len(current) + len(joiner) + len(sent) <= _CHUNK_MAX:
            current = current + joiner + sent
        else:
            if current:
                chunks.append(current)
            while len(sent) > _CHUNK_MAX:
                chunks.append(sent[:_CHUNK_MAX].rstrip())
                sent = sent[_CHUNK_MAX:].strip()
            current = sent
    if current:
        chunks.append(current)

    return chunks or [text[:_CHUNK_MAX]]


def _concat_wav(wav_list: list[bytes]) -> bytes:
    """
    Concatenate WAV blobs into one gapless WAV file.
    Validates that all clips share the same PCM params before merging.
    """
    if len(wav_list) == 1:
        return wav_list[0]

    frames_all: list[bytes] = []
    params = None

    for i, wav_bytes in enumerate(wav_list):
        try:
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                clip_params = wf.getparams()
                if params is None:
                    params = clip_params
                elif (clip_params.nchannels  != params.nchannels  or
                      clip_params.sampwidth  != params.sampwidth  or
                      clip_params.framerate  != params.framerate):
                    logger.warning("[Sarvam] Chunk %d has different WAV params — skipping", i)
                    continue
                frames_all.append(wf.readframes(wf.getnframes()))
        except Exception as exc:
            logger.warning("[Sarvam] Could not decode WAV chunk %d: %s", i, exc)

    if not frames_all or params is None:
        return wav_list[0]

    buf = io.BytesIO()
    with wave.open(buf, "wb") as out:
        out.setparams(params)
        for frames in frames_all:
            out.writeframes(frames)
    buf.seek(0)
    return buf.read()


# ── Core synthesis ────────────────────────────────────────────────────────────

def _call_api(text_chunk: str, lang_code: str, speaker: str,
              pace: float, pitch: float, loudness: float,
              api_key: str) -> bytes:
    """
    Make ONE Sarvam TTS API call for a single text chunk.
    Returns raw WAV bytes.
    Raises RuntimeError on any failure.
    """
    payload = {
        "text":                 text_chunk,      # ← single string, NOT a list
        "target_language_code": lang_code,
        "speaker":              speaker,
        "pace":                 pace,
        "pitch":                pitch,
        "loudness":             loudness,
        "speech_sample_rate":   22050,
        "enable_preprocessing": True,
        "model":                MODEL,           # bulbul:v2
    }
    headers = {
        "api-subscription-key": api_key,
        "Content-Type":         "application/json",
    }

    try:
        resp = requests.post(
            SARVAM_TTS_URL, json=payload, headers=headers, timeout=60
        )
    except requests.exceptions.Timeout:
        raise RuntimeError("Sarvam API timed out (60 s)")
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Sarvam API network error: {exc}") from exc

    if not resp.ok:
        # Surface the actual Sarvam error message for debugging
        try:
            err_body = resp.json()
            err_msg  = err_body.get("error", {}).get("message", resp.text[:400])
        except Exception:
            err_msg = resp.text[:400]
        raise RuntimeError(
            f"Sarvam API error {resp.status_code}: {err_msg}"
        )

    try:
        data = resp.json()
    except Exception as exc:
        raise RuntimeError(f"Sarvam returned non-JSON response: {exc}") from exc

    audios: list[str] = data.get("audios", [])
    if not audios:
        raise RuntimeError("Sarvam returned no audio in response")

    try:
        return base64.b64decode(audios[0])
    except Exception as exc:
        raise RuntimeError(f"Failed to decode Sarvam base64 audio: {exc}") from exc


def synthesize(
    text:     str,
    language: str   = "Hindi",
    speaker:  str   = DEFAULT_SPEAKER,
    pace:     float = TEACHING_PACE,
    pitch:    float = TEACHING_PITCH,
    loudness: float = TEACHING_LOUDNESS,
) -> bytes:
    """
    Synthesize `text` with Sarvam AI and return a WAV byte string.

    • text     : plain text (markdown / emoji stripped automatically)
    • language : language name ("Hindi", "Tamil" …) or BCP-47 ("hi-IN")
    • speaker  : bulbul:v2 speaker name (default "anushka")
    • pace     : 0.3 – 3.0  (1.0 = normal speed)
    • pitch    : -0.75 – 0.75
    • loudness : 0.3 – 3.0

    Raises RuntimeError for API/key errors, ValueError for empty text.
    """
    api_key = get_api_key()
    if not api_key or api_key == "your_sarvam_api_key_here":
        raise RuntimeError(
            "SARVAM_API_KEY is not set.  "
            "Add it to backend/.env — get your key at https://app.sarvam.ai/"
        )

    text = clean_for_speech(text)
    if not text:
        raise ValueError("Empty text after cleanup")

    # Resolve language → BCP-47 code
    if language in LANG_CODE_MAP:
        lang_code = LANG_CODE_MAP[language]
    elif "-" in language:
        lang_code = language                     # already "hi-IN" etc.
    else:
        lang_code = "hi-IN"                      # safe fallback

    # Validate / normalise params
    if speaker not in AVAILABLE_SPEAKERS:
        logger.warning("[Sarvam] Unknown speaker %r — using default %r", speaker, DEFAULT_SPEAKER)
        speaker  = DEFAULT_SPEAKER
    pace     = max(0.3, min(3.0, pace))
    pitch    = max(-0.75, min(0.75, pitch))
    loudness = max(0.3, min(3.0, loudness))

    # Split into ≤ _CHUNK_MAX chunks and call API once per chunk
    chunks = _split_chunks(text)
    logger.info(
        "[Sarvam] synthesise %d chunk(s), total %d chars, lang=%s, speaker=%s",
        len(chunks), len(text), lang_code, speaker,
    )

    if len(chunks) == 1:
        # Single chunk — skip thread pool overhead
        wav_blobs = [_call_api(chunks[0], lang_code, speaker, pace, pitch, loudness, api_key)]
    else:
        # Multiple chunks → synthesise in parallel so total time ≈ slowest chunk
        # (instead of sum of all chunks sequentially)
        max_workers = min(len(chunks), 4)
        wav_blobs   = [None] * len(chunks)          # pre-allocate to preserve order

        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            future_to_idx = {
                pool.submit(
                    _call_api, chunk, lang_code, speaker, pace, pitch, loudness, api_key
                ): i
                for i, chunk in enumerate(chunks)
            }
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                wav_blobs[idx] = future.result()    # raises on error → propagates

    return _concat_wav(wav_blobs)
