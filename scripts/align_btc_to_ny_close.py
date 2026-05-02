#!/usr/bin/env python3
"""Align hourly BTC data to New York market-close observations.

The script selects the observation whose New York local hour is 16.
This gives one BTC row per calendar date in New York.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    df = pd.read_csv(args.input)
    if not {"timestamp_utc", "close_price"}.issubset(df.columns):
        raise SystemExit("Input must contain timestamp_utc and close_price columns.")

    ts = pd.to_datetime(df["timestamp_utc"], utc=True, errors="coerce")
    ny = ts.dt.tz_convert(ZoneInfo("America/New_York"))
    df = df.assign(
        timestamp_utc=ts,
        timestamp_ny=ny,
        trading_date=ny.dt.date,
        hour_ny=ny.dt.hour,
        btc_price_ny_close=pd.to_numeric(df["close_price"], errors="coerce"),
    )

    out = (
        df[df["hour_ny"] == 16][["trading_date", "btc_price_ny_close"]]
        .dropna()
        .drop_duplicates(subset=["trading_date"], keep="last")
        .rename(columns={"trading_date": "date"})
        .sort_values("date")
        .reset_index(drop=True)
    )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)
    print(f"Wrote {len(out)} rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
