from __future__ import annotations

import math
import threading
import time
from collections.abc import Callable


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after
        super().__init__(f"Rate limit exceeded; retry in {retry_after} seconds")


class FixedWindowLimiter:
    def __init__(
        self,
        *,
        clock: Callable[[], float] = time.monotonic,
        max_keys: int = 10_000,
    ) -> None:
        if max_keys < 1:
            raise ValueError("max_keys must be positive")
        self._clock = clock
        self._max_keys = max_keys
        self._buckets: dict[str, tuple[float, int]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        if limit < 1 or window_seconds < 1:
            raise ValueError("limit and window_seconds must be positive")

        now = self._clock()
        with self._lock:
            started, count = self._buckets.get(key, (now, 0))
            if now - started >= window_seconds:
                started, count = now, 0

            if count >= limit:
                retry_after = max(1, math.ceil(window_seconds - (now - started)))
                raise RateLimitExceeded(retry_after)

            if key not in self._buckets and len(self._buckets) >= self._max_keys:
                oldest = min(self._buckets, key=lambda item: self._buckets[item][0])
                self._buckets.pop(oldest, None)

            self._buckets[key] = (started, count + 1)

    def clear(self, key: str) -> None:
        with self._lock:
            self._buckets.pop(key, None)

    def clear_all(self) -> None:
        with self._lock:
            self._buckets.clear()
