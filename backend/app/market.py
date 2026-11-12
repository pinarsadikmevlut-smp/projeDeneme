"""Altınkaynak quote adapter.

One background poller per backend process, 10-second monotonic cadence.
HTTP clients only read an immutable cached snapshot; they never wait for upstream I/O.
"""
import json
import logging
import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

GOLD_URL = "https://static.altinkaynak.com/public/Gold"
CURRENCY_URL = "https://static.altinkaynak.com/public/Currency"
POLL_SECONDS = 10.0
UPSTREAM_TIMEOUT_SECONDS = 4
MAX_SOURCE_AGE_SECONDS = 300
TURKEY_TZ = timezone(timedelta(hours=3))

# Keep IDs stable for the Sales module; show every other returned source code too.
KNOWN = {
    ("gold", "PGA"): ("gram", "Gram Altın 24k", "Has & Külçe", "24k / 1.000"),
    ("gold", "HH_T"): ("has1000", "Has Altın 1.000", "Has & Külçe", "1.000"),
    ("gold", "C"): ("ceyrek", "Çeyrek Altın", "Ziynet & Ata", "22k"),
    ("gold", "Y"): ("yarim", "Yarım Altın", "Ziynet & Ata", "22k"),
    ("gold", "T"): ("tam", "Tam Altın", "Ziynet & Ata", "22k"),
    ("gold", "PB"): ("bilezik22", "22 Ayar Bilezik", "İşçilikli", "22k / 0.916"),
    ("gold", "P18"): ("altin18", "18 Ayar Altın", "İşçilikli", "18k / 0.750"),
    ("gold", "P14"): ("altin14", "14 Ayar Altın", "İşçilikli", "14k / 0.585"),
    ("currency", "USD"): ("usd", "USD/TL", "Döviz", "USD"),
    ("currency", "EUR"): ("eur", "EUR/TL", "Döviz", "EUR"),
}


def parse_price(value):
    """Altınkaynak: '6.259' = 6259 TL, '50,220' = 50.220 TL."""
    if isinstance(value, bool):
        raise ValueError("Boolean is not a price")
    if isinstance(value, (int, float)):
        result = float(value)
    elif isinstance(value, str):
        raw = value.strip().replace(" ", "")
        if not re.fullmatch(r"\d+(?:[.,]\d+)*", raw):
            raise ValueError("Invalid price text")
        if "," in raw:
            # Turkish decimal comma, dot thousands groups.
            if raw.count(",") != 1:
                raise ValueError("Invalid decimal separator")
            raw = raw.replace(".", "").replace(",", ".")
        elif "." in raw:
            parts = raw.split(".")
            if len(parts) > 1 and all(len(part) == 3 for part in parts[1:]):
                raw = "".join(parts)
            elif len(parts) != 2:
                raise ValueError("Invalid grouped number")
        result = float(raw)
    else:
        raise ValueError("Invalid price type")
    if not math.isfinite(result) or not 0 < result < 1e9:
        raise ValueError("Out-of-range price")
    return result


def parse_source_time(value):
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        local = datetime.strptime(value.strip(), "%d.%m.%Y %H:%M:%S")
        return local.replace(tzinfo=TURKEY_TZ).astimezone(timezone.utc)
    except ValueError:
        return None


def fetch_json(url):
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "pinarGold/market-monitor"})
    with urlopen(req, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
        if response.headers.get_content_type() not in ("application/json", "text/plain"):
            raise ValueError("Unexpected upstream content type")
        # Bounded read: unexpected untrusted feeds must not exhaust server memory.
        data = response.read(1024 * 1024 + 1)
        if len(data) > 1024 * 1024:
            raise ValueError("Oversized upstream response")
    return json.loads(data)


def normalize_feed(group, items, now_utc=None, force_stale=False):
    """Return every valid quote, preserving source metadata and its own freshness."""
    if not isinstance(items, list) or len(items) > 500:
        raise ValueError("Unexpected Altinkaynak response")
    now_utc = now_utc or datetime.now(timezone.utc)
    result = []
    seen = set()
    for row in items:
        if not isinstance(row, dict):
            continue
        code = str(row.get("Kod") or "").strip()
        if not code or code in seen:
            continue
        try:
            buy, sell = parse_price(row.get("Alis")), parse_price(row.get("Satis"))
        except (ValueError, TypeError):
            continue
        if sell < buy:
            continue
        seen.add(code)
        known = KNOWN.get((group, code))
        name_from_source = str(row.get("Aciklama") or code).strip()
        ident, name, category, purity = known if known else (
            f"{group}:{code}",
            name_from_source,
            ("Gümüş" if group == "gold" and code.startswith("AG") else
             "Diğer Altın" if group == "gold" else "Döviz"),
            "—",
        )
        raw_time = row.get("GuncellenmeZamani")
        source_time = parse_source_time(raw_time)
        age = (now_utc - source_time).total_seconds() if source_time else None
        stale = force_stale or age is None or age > MAX_SOURCE_AGE_SECONDS or age < -120
        result.append({
            "id": ident, "name": name, "category": category, "purity": purity,
            "buy": buy, "sell": sell, "sourceCode": code, "sourceType": group,
            "providerName": name_from_source, "isMobile": row.get("IsMobile"),
            "sourceUpdatedAt": raw_time if isinstance(raw_time, str) else None,
            "sourceTimestamp": source_time.isoformat() if source_time else None,
            "stale": bool(stale),
        })
    if not result:
        raise ValueError(f"No valid {group} quotes")
    return result


class QuoteStore:
    def __init__(self, fetcher=fetch_json, interval=POLL_SECONDS, clock=None, monotonic=None):
        self.fetcher = fetcher
        self.interval = interval
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.monotonic = monotonic or time.monotonic
        self._lock = threading.Lock()
        self._refresh_lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = None
        self._feeds = {}
        self._success_times = {}
        self._snapshot = self._empty_snapshot("warming")

    def _empty_snapshot(self, state):
        return {
            "source": "Altınkaynak", "mode": "live", "state": state,
            "quotes": [], "quoteCount": 0, "staleCount": 0,
            "fetchedAt": None, "checkedAt": None, "intervalSeconds": self.interval,
            "stale": True, "feedStatus": {}, "error": None,
        }

    def start(self):
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop.clear()
            self._thread = threading.Thread(target=self._loop, name="altinkaynak-poller", daemon=True)
            self._thread.start()

    def stop(self, timeout=6):
        self._stop.set()
        thread = self._thread
        if thread is not None:
            thread.join(timeout=timeout)

    def get_snapshot(self, start=True):
        if start:
            self.start()
        with self._lock:
            return self._snapshot

    def _loop(self):
        target = self.monotonic()
        while not self._stop.is_set():
            delay = max(0, target - self.monotonic())
            if self._stop.wait(delay):
                return
            try:
                self.refresh_once()
            except Exception:  # Never let an unexpected feed shape kill the polling loop.
                logger.exception("Market refresh failed unexpectedly")
                with self._lock:
                    current = self._snapshot
                    self._snapshot = {
                        **current,
                        "state": "error", "stale": True,
                        "quotes": [{**item, "stale": True} for item in current["quotes"]],
                        "staleCount": len(current["quotes"]),
                        "error": "Market poller error",
                    }
            target += self.interval
            # No overlapping fetches or bursts after slow/outage conditions.
            if target <= self.monotonic():
                target = self.monotonic() + self.interval

    def refresh_once(self):
        """Do upstream work outside the reader lock, then atomically publish."""
        if not self._refresh_lock.acquire(blocking=False):
            return self.get_snapshot(start=False)
        try:
            with ThreadPoolExecutor(max_workers=2, thread_name_prefix="altinkaynak-source") as pool:
                futures = {
                    group: pool.submit(self.fetcher, url)
                    for group, url in (("gold", GOLD_URL), ("currency", CURRENCY_URL))
                }
                responses = {}
                errors = {}
                for group, future in futures.items():
                    try:
                        payload = future.result()
                        # Validate before replacing a previously good feed.
                        normalize_feed(group, payload, now_utc=self.clock())
                        responses[group] = payload
                    except Exception as exc:  # Isolate malformed upstream data per feed.
                        errors[group] = type(exc).__name__
            checked = self.clock()
            with self._lock:
                for group, payload in responses.items():
                    self._feeds[group] = payload
                    self._success_times[group] = checked.isoformat()
                quotes = []
                feed_status = {}
                for group in ("gold", "currency"):
                    available = group in self._feeds
                    healthy = group in responses
                    feed_status[group] = {
                        "ok": healthy,
                        "available": available,
                        "lastSuccessfulAt": self._success_times.get(group),
                    }
                    if available:
                        quotes.extend(normalize_feed(group, self._feeds[group], checked, force_stale=not healthy))
                stale_count = sum(quote["stale"] for quote in quotes)
                fresh_count = len(quotes) - stale_count
                state = ("unavailable" if not quotes else
                         "live" if stale_count == 0 else
                         "partial" if fresh_count else "stale")
                last_success = max(self._success_times.values()) if self._success_times else None
                self._snapshot = {
                    "source": "Altınkaynak", "mode": "live", "state": state,
                    "quotes": quotes, "quoteCount": len(quotes), "staleCount": stale_count,
                    "fetchedAt": last_success, "checkedAt": checked.isoformat(),
                    "intervalSeconds": self.interval, "stale": stale_count > 0 or bool(errors),
                    "feedStatus": feed_status,
                    "error": "Some upstream feeds unavailable" if errors else None,
                }
                return self._snapshot
        finally:
            self._refresh_lock.release()


market_store = QuoteStore()


def get_market_data():
    return market_store.get_snapshot()
