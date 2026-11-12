from app.market import GOLD_URL, CURRENCY_URL, normalize, parse_price, get_market_data, reset_cache

def test_turkish_numbers():
    assert parse_price("6.239") == 6239
    assert parse_price("50,212") == 50.212
    assert parse_price("6.123,45") == 6123.45

def test_symbol_mapping():
    data = normalize(
        [{"Kod": "PGA", "Alis": "6.239", "Satis": "6.395", "GuncellenmeZamani": "12.11.2026 18:54:25"},
         {"Kod": "C", "Alis": "10.070", "Satis": "10.419"}],
        [{"Kod": "USD", "Alis": "50,212", "Satis": "50,407"}],
    )
    assert [x["id"] for x in data] == ["gram", "ceyrek", "usd"]
    assert data[0]["sell"] == 6395
    assert data[2]["buy"] == 50.212

def test_cache_10_seconds():
    reset_cache()
    calls = []
    def fetch(url):
        calls.append(url)
        if url == GOLD_URL:
            return [{"Kod": "PGA", "Alis": "6.239", "Satis": "6.395"}]
        return [{"Kod": "USD", "Alis": "50,212", "Satis": "50,407"}]
    first = get_market_data(fetcher=fetch, now=lambda: 100)
    second = get_market_data(fetcher=fetch, now=lambda: 105)
    assert first["mode"] == "live"
    assert second["cached"] is True
    assert len(calls) == 2
    third = get_market_data(fetcher=fetch, now=lambda: 111)
    assert third["cached"] is False
    assert len(calls) == 4
    reset_cache()

def test_failure_marks_quotes_stale():
    reset_cache()
    def fetch(url):
        if url == GOLD_URL:
            return [{"Kod": "PGA", "Alis": "6.239", "Satis": "6.395"}]
        return [{"Kod": "USD", "Alis": "50,212", "Satis": "50,407"}]
    get_market_data(fetcher=fetch, now=lambda: 100)
    def broken(url):
        raise OSError("offline")
    result = get_market_data(fetcher=broken, now=lambda: 111)
    assert result["stale"] is True
    assert len(result["quotes"]) == 2
    reset_cache()
