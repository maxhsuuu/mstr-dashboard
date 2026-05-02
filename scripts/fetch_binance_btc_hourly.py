#!/usr/bin/env python3
"""Fetch BTCUSDT hourly data from Binance.

This produces a CSV that can later be aligned to New York market close.
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

BASE_URL = "https://api.binance.com/api/v3/klines"


def to_ms(date_str: str) -> int:
    dt = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def fetch_chunk(symbol: str, start_ms: int, end_ms: int, limit: int = 1000):
    query = urlencode({
        "symbol": symbol,
        "interval": "1h",
        "startTime": start_ms,
        "endTime": end_ms,
        "limit": limit,
    })
    with urlopen(f"{BASE_URL}?{query}") as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", required=True, help="UTC ISO date, for example 2025-01-01")
    parser.add_argument("--end", required=True, help="UTC ISO date, for example 2025-02-01")
    parser.add_argument("--symbol", default="BTCUSDT")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    start_ms = to_ms(args.start)
    end_ms = to_ms(args.end)
    current = start_ms
    rows = []

    while current < end_ms:
        chunk = fetch_chunk(args.symbol, current, end_ms)
        if not chunk:
            break
        rows.extend(chunk)
        current = int(chunk[-1][0]) + 3600 * 1000
        if len(chunk) < 1000:
            break

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["timestamp_utc", "close_price"])
        for item in rows:
            ts = datetime.fromtimestamp(item[0] / 1000, tz=timezone.utc).isoformat()
            writer.writerow([ts, item[4]])

    print(f"Wrote {len(rows)} hourly rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
