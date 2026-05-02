#!/usr/bin/env python3
"""Build the final daily dataset for the dashboard."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "date" not in df.columns:
        raise SystemExit(f"File has no date column: {path}")
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    df = df.dropna(subset=["date"]).copy()
    return df


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strategytracker", required=True, help="Normalized StrategyTracker CSV")
    parser.add_argument("--btc", help="Optional BTC daily CSV with date + btc_price_ny_close")
    parser.add_argument("--mstr", help="Optional MSTR daily CSV with date + mstr_price")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    base = load_csv(args.strategytracker).sort_values("date")

    if args.btc:
        btc = load_csv(args.btc)
        btc_cols = [c for c in btc.columns if c == "date" or c.startswith("btc_")]
        base = base.merge(btc[btc_cols], on="date", how="left")

    if args.mstr:
        mstr = load_csv(args.mstr)
        mstr_cols = [c for c in mstr.columns if c == "date" or c.startswith("mstr_")]
        base = base.merge(mstr[mstr_cols], on="date", how="left")

    numeric_cols = [c for c in base.columns if c != "date"]
    for col in numeric_cols:
        base[col] = pd.to_numeric(base[col], errors="coerce")

    base = base.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    base.to_csv(output_path, index=False)
    print(f"Wrote {len(base)} rows to {output_path}")
    print(f"Columns: {', '.join(base.columns)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
