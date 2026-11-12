"""Altınkaynak public JSON adapter with shared 10-second cache."""
import json
import threading
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen

GOLD_URL = "https://static.altinkaynak.com/public/Gold"
CURRENCY_URL = "https://static.altinkaynak.com/public/Currency"
CACHE_SECONDS = 10
_lock = threading.Lock()
_cache = {"fetched_at": 0, "data": None, "error": None}

# Explicit source codes avoid confusing retail and wholesale products.
PRODUCTS = (
    ("gram", "Gram Altın 24k", "Has & Külçe", "24k / 1.000", "gold", "PGA"),
    ("has995", "Has Altın 0.995", "Has & Külçe", "0.995", "gold", "CH_T"),
    ("has1000", "Has Altın 1.000", "Has & Külçe", "1.000", "gold", "HH_T"),
    ("ceyrek", "Çeyrek Altın", "Ziynet & Ata", "22k", "gold", "C"),
    ("yarim", "Yarım Altın", "Ziynet & Ata", "22k", "gold", "Y"),
    ("tam", "Tam Altın", "Ziynet & Ata", "22k", "gold", "T"),
    ("bilezik22", "22 Ayar Bilezik", "İşçilikli", "22k / 0.916", "gold", "PB"),
    ("altin18", "18 Ayar Altın", "İşçilikli", "18k / 0.750", "gold", "P18"),
    ("altin14", "14 Ayar Altın", "İşçilikli", "14k / 0.585", "gold", "P14"),
    ("usd", "USD/TL", "Döviz", "USD", "currency", "USD"),
    ("eur", "EUR/TL", "Döviz", "EUR", "currency", "EUR"),
)

def parse_price(value):
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        raise ValueError("Invalid price type")
    value = value.strip().replace(".", "").replace(",", ".")
    result = float(value)
    if not 0 < result < 1e9:
        raise ValueError("Invalid price")
    return result

def fetch_json(url):
    request = Request(url, headers={"Accept": "application/json", "User-Agent": "pinarGold/1.0"})
    with urlopen(request, timeout=5) as response:
        return json.load(response)

def normalize(gold, currency):
    if not isinstance(gold, list) or not isinstance(currency, list):
        raise ValueError("Unexpected Altinkaynak payload")
    indexes = {
        "gold": {item["Kod"]: item for item in gold if isinstance(item, dict) and "Kod" in item},
        "currency": {item["Kod"]: item for item in currency if isinstance(item, dict) and "Kod" in item},
    }
    result = []
    for ident, name, category, purity, source, code in PRODUCTS:
        raw = indexes[source].get(code)
        if not raw:
            continue
        try:
            buy, sell = parse_price(raw["Alis"]), parse_price(raw["Satis"])
        except (KeyError, TypeError, ValueError):
            continue
        if sell < buy:
            continue
        result.append({"id": ident, "name": name, "category": category,
                       "purity": purity, "buy": buy, "sell": sell,
                       "sourceCode": code, "sourceUpdatedAt": raw.get("GuncellenmeZamani")})
    if not result:
        raise ValueError("No valid Altinkaynak quotes")
    return result

def get_market_data(fetcher=fetch_json, now=time.monotonic):
    with _lock:
        current = now()
        if current - _cache["fetched_at"] < CACHE_SECONDS and _cache["data"] is not None:
            return {**_cache["data"], "cached": True}
        try:
            quotes = normalize(fetcher(GOLD_URL), fetcher(CURRENCY_URL))
            payload = {"source": "Altınkaynak", "mode": "live", "quotes": quotes,
                       "fetchedAt": datetime.now(timezone.utc).isoformat(),
                       "intervalSeconds": CACHE_SECONDS, "stale": False}
            _cache.update(fetched_at=now(), data=payload, error=None)
            return {**payload, "cached": False}
        except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            # Serve last known quotes ONLY with explicit stale flag.
            _cache["fetched_at"] = now()
            _cache["error"] = str(exc)
            if _cache["data"] is not None:
                return {**_cache["data"], "cached": True, "stale": True, "error": "Upstream unavailable"}
            return {"source": "Altınkaynak", "mode": "live", "quotes": [],
                    "fetchedAt": None, "intervalSeconds": CACHE_SECONDS,
                    "stale": True, "error": "Upstream unavailable"}

def reset_cache():
    with _lock:
        _cache.update(fetched_at=0, data=None, error=None)
