#!/usr/bin/env python3
"""Fetch daily MSTR prices from Alpha Vantage."""

from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
import json

import pandas as pd

BASE_URL = "https://www.alphavantage.co/query"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--symbol", default="MSTR")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    query = urlencode({
        "function": "TIME_SERIES_DAILY_ADJUSTED",
        "symbol": args.symbol,
        "outputsize": "full",
        "apikey": args.api_key,
    })

    with urlopen(f"{BASE_URL}?{query}") as response:
        payload = json.loads(response.read().decode("utf-8"))

    series = payload.get("Time Series (Daily)")
    if not series:
        raise SystemExit(f"Unexpected Alpha Vantage response: {payload}")

    rows = []
    for dt, values in series.items():
        rows.append({
            "date": dt,
            "mstr_open": values.get("1. open"),
            "mstr_high": values.get("2. high"),
            "mstr_low": values.get("3. low"),
            "mstr_price": values.get("4. close"),
            "mstr_adjusted_close": values.get("5. adjusted close"),
            "mstr_volume": values.get("6. volume"),
        })

    df = pd.DataFrame(rows)
    for col in df.columns:
        if col != "date":
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.sort_values("date").reset_index(drop=True)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Wrote {len(df)} rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
