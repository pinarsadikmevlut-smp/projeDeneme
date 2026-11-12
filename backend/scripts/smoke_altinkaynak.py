"""Real-network Altınkaynak smoke test: two independent polls 10s apart.

Run from backend/: python scripts/smoke_altinkaynak.py
This verifies upstream accessibility and schema, NOT that upstream prices change.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.market import QuoteStore  # noqa: E402


def main():
    store = QuoteStore()
    start1 = time.monotonic()
    first = store.refresh_once()
    if first["quoteCount"] < 10 or not {"gram", "ceyrek", "usd"}.issubset(
        {quote["id"] for quote in first["quotes"]}
    ):
        raise SystemExit(f"FAILED: first live response: {first['state']}, {first['quoteCount']} assets")
    wait = max(0, 10 - (time.monotonic() - start1))
    time.sleep(wait)
    start2 = time.monotonic()
    second = store.refresh_once()
    if start2 - start1 < 9.9:
        raise SystemExit("FAILED: the next poll started before the 10-second boundary")
    if second["quoteCount"] < 10:
        raise SystemExit(f"FAILED: second live response: {second['state']}")
    first_by_id = {q["id"]: q for q in first["quotes"]}
    second_by_id = {q["id"]: q for q in second["quotes"]}
    changed = sum(
        first_by_id[id]["buy"] != second_by_id[id]["buy"] or
        first_by_id[id]["sell"] != second_by_id[id]["sell"]
        for id in first_by_id.keys() & second_by_id.keys()
    )
    print("PASS: two real Altınkaynak polls", round(start2-start1, 3), "seconds apart")
    print("First:", first["quoteCount"], "assets, stale:", first["staleCount"])
    print("Second:", second["quoteCount"], "assets, stale:", second["staleCount"])
    print("Price changes:", changed, "(0 is valid when the provider has not updated prices)")
    print("Feed health:", second["feedStatus"])
    if any(not state["ok"] for state in second["feedStatus"].values()):
        raise SystemExit("FAILED: one or more real Altınkaynak endpoints unavailable")


if __name__ == "__main__":
    main()
