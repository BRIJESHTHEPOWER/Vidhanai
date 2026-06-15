"""
Simple thread-safe TTL response cache.
Used by /ask and /simplify endpoints to avoid duplicate Gemini calls.
"""
import time
import hashlib
import threading
from typing import Optional

_lock = threading.Lock()


class TTLCache:
    """
    In-memory LRU-style cache with TTL expiry.
    Thread-safe for multi-threaded FastAPI/uvicorn workers.
    """

    def __init__(self, max_size: int = 200, ttl_seconds: int = 600):
        self._store: dict = {}          # key → (value, expires_at)
        self._max_size = max_size
        self._ttl = ttl_seconds

    def _make_key(self, *args: str) -> str:
        raw = "|".join(str(a).lower().strip() for a in args)
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def get(self, *key_parts: str) -> Optional[str]:
        key = self._make_key(*key_parts)
        with _lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, value: str, *key_parts: str) -> None:
        key = self._make_key(*key_parts)
        with _lock:
            # Evict oldest entries if at capacity
            if len(self._store) >= self._max_size:
                now = time.monotonic()
                # Remove all expired first
                expired = [k for k, (_, exp) in self._store.items() if now > exp]
                for k in expired:
                    del self._store[k]
                # If still at capacity, remove oldest by expiry
                if len(self._store) >= self._max_size:
                    oldest = min(self._store.items(), key=lambda kv: kv[1][1])
                    del self._store[oldest[0]]
            self._store[key] = (value, time.monotonic() + self._ttl)

    def clear(self) -> None:
        with _lock:
            self._store.clear()

    @property
    def size(self) -> int:
        with _lock:
            return len(self._store)


# Singleton caches used across the app
ask_cache      = TTLCache(max_size=200, ttl_seconds=600)   # /ask — 10 min
simplify_cache = TTLCache(max_size=100, ttl_seconds=300)   # /simplify — 5 min
