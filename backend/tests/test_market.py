import threading
import time
from datetime import datetime, timezone

import pytest

from app.market import (
    CURRENCY_URL, GOLD_URL, QuoteStore, normalize_feed, parse_price,
    parse_source_time,
)

UTC_NOW = datetime(2026, 11, 12, 16, 30, tzinfo=timezone.utc)
DATE_TEXT = "12.11.2026 19:30:00"


def gold_fixture(n=3, date=DATE_TEXT):
    codes = ["PGA", "HH_T", "C"] + [f"EXTRA{i}" for i in range(max(0, n - 3))]
    return [
        {
            "Kod": code,
            "Aciklama": f"Altın ürünü {i}",
            "Alis": f"{6250 + i:,}".replace(",", "."),
            "Satis": f"{6350 + i:,}".replace(",", "."),
            "GuncellenmeZamani": date,
            "IsMobile": i % 2 == 0,
        }
        for i, code in enumerate(codes[:n])
    ]


def currency_fixture(n=2, date=DATE_TEXT):
    codes = ["USD", "EUR"] + [f"FX{i}" for i in range(max(0, n - 2))]
    return [
        {
            "Kod": code,
            "Aciklama": f"Döviz {i}",
            "Alis": f"50,{i:03d}",
            "Satis": f"51,{i:03d}",
            "GuncellenmeZamani": date,
            "IsMobile": True,
        }
        for i, code in enumerate(codes[:n])
    ]


def make_store(interval=10):
    def fetch(url):
        return gold_fixture(53) if url == GOLD_URL else currency_fixture(14)
    return QuoteStore(fetcher=fetch, interval=interval, clock=lambda: UTC_NOW)


@pytest.mark.parametrize("raw,expected", [
    ("6.259", 6259),
    ("3.114.067", 3114067),
    ("50,220", 50.22),
    ("0,3096", 0.3096),
    ("19.908,45", 19908.45),
    ("50.55", 50.55),
])
def test_turkish_price_formats(raw, expected):
    assert parse_price(raw) == pytest.approx(expected)


@pytest.mark.parametrize("bad", ["", "NaN", "-5", "0", "1,2,3", float("inf"), True])
def test_invalid_prices_rejected(bad):
    with pytest.raises(ValueError):
        parse_price(bad)


def test_timestamp_has_turkey_timezone():
    assert parse_source_time(DATE_TEXT).isoformat() == "2026-11-12T16:30:00+00:00"


def test_all_response_quotes_and_metadata_preserved():
    store = make_store()
    result = store.refresh_once()
    assert result["quoteCount"] == 67
    assert result["staleCount"] == 0
    assert result["state"] == "live"
    assert len(set(q["id"] for q in result["quotes"])) == 67
    by_id = {q["id"]: q for q in result["quotes"]}
    assert by_id["gram"]["sourceCode"] == "PGA"
    assert by_id["gram"]["sell"] == 6350
    assert by_id["ceyrek"]["sourceCode"] == "C"
    assert by_id["usd"]["buy"] == 50
    assert by_id["currency:FX11"]["sourceCode"] == "FX11"
    assert by_id["gold:EXTRA49"]["providerName"] == "Altın ürünü 52"
    assert by_id["gram"]["isMobile"] is True
    assert by_id["gram"]["sourceTimestamp"] == UTC_NOW.isoformat()


def test_per_quote_staleness_and_partial_state():
    def fetch(url):
        return gold_fixture(date=DATE_TEXT) if url == GOLD_URL else currency_fixture(date="12.11.2026 19:00:00")
    store = QuoteStore(fetcher=fetch, clock=lambda: UTC_NOW)
    response = store.refresh_once()
    assert response["state"] == "partial"
    assert response["staleCount"] == 2
    assert next(q for q in response["quotes"] if q["id"] == "gram")["stale"] is False
    assert next(q for q in response["quotes"] if q["id"] == "usd")["stale"] is True


def test_partial_upstream_failure_keeps_good_prices_with_warning():
    fail_currency = False
    def fetch(url):
        if url == CURRENCY_URL and fail_currency:
            raise OSError("offline")
        return gold_fixture() if url == GOLD_URL else currency_fixture()
    store = QuoteStore(fetcher=fetch, clock=lambda: UTC_NOW)
    ok = store.refresh_once()
    assert len(ok["quotes"]) == 5
    fail_currency = True
    response = store.refresh_once()
    assert len(response["quotes"]) == 5
    assert response["feedStatus"]["currency"]["ok"] is False
    assert response["state"] == "partial"
    assert next(q for q in response["quotes"] if q["id"] == "usd")["stale"] is True
    assert next(q for q in response["quotes"] if q["id"] == "gram")["stale"] is False


def test_http_reads_do_not_block_on_slow_upstream():
    entered = threading.Event()
    release = threading.Event()
    def slow_fetch(url):
        entered.set()
        release.wait(timeout=2)
        return gold_fixture() if url == GOLD_URL else currency_fixture()
    store = QuoteStore(fetcher=slow_fetch, clock=lambda: UTC_NOW)
    worker = threading.Thread(target=store.refresh_once)
    worker.start()
    assert entered.wait(timeout=2)
    t0 = time.monotonic()
    response = store.get_snapshot(start=False)
    elapsed = time.monotonic() - t0
    release.set()
    worker.join(timeout=3)
    assert response["state"] == "warming"
    assert elapsed < 0.15


def test_background_poller_runs_on_fixed_interval():
    calls = []
    observed = threading.Event()
    lock = threading.Lock()
    def fetch(url):
        if url == GOLD_URL:
            with lock:
                calls.append(time.monotonic())
                if len(calls) >= 3:
                    observed.set()
        return gold_fixture() if url == GOLD_URL else currency_fixture()
    store = QuoteStore(fetcher=fetch, interval=0.07, clock=lambda: UTC_NOW)
    try:
        store.start()
        assert observed.wait(timeout=3), "The poller did not make three source calls"
    finally:
        store.stop()
    with lock:
        differences = [b-a for a,b in zip(calls, calls[1:3])]
    assert len(differences) == 2
    assert all(0.04 <= duration <= 0.25 for duration in differences)


def test_endpoint_returns_in_memory_snapshot(monkeypatch):
    import app.market as market_module
    from app import create_app

    store = make_store()
    store.refresh_once()
    monkeypatch.setattr(market_module, "market_store", store)
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite://",
                      "JWT_SECRET_KEY": "test-market-signing-secret-long-enough-1234",
                      "SESSION_COOKIE_SECURE": False})
    from app import db
    with app.app_context():
        db.create_all()
    client = app.test_client()
    assert client.post("/api/auth/register", json={
        "username": "marketuser", "password": "strong-market-password-12345"
    }).status_code == 201
    # Do not start a background test thread: replace start with a no-op.
    monkeypatch.setattr(store, "start", lambda: None)
    response = client.get("/api/market/prices")
    assert response.status_code == 200
    assert response.json["quoteCount"] == 67
    assert response.headers["Cache-Control"] == "no-store"
