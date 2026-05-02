#!/usr/bin/env python3
"""Normalize a raw StrategyTracker export into a clean daily CSV.

The script is intentionally tolerant: it scans the incoming headers, finds a date column,
normalizes obvious mNAV-like columns, and writes a cleaned file for the dashboard pipeline.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys

import pandas as pd

HEADER_MAP = {
    "mnav ev": "mnav_ev",
    "mnav_ev": "mnav_ev",
    "mnav diluted": "mnav_diluted",
    "mnav_diluted": "mnav_diluted",
    "diluted mnav": "mnav_diluted",
    "mnav basic": "mnav_basic",
    "mnav_basic": "mnav_basic",
    "mnav": "mnav",
    "btc holdings": "btc_holdings",
    "bitcoin holdings": "btc_holdings",
    "mstr price": "mstr_price",
    "btc price": "btc_price",
    "btc price ny close": "btc_price_ny_close",
}

DATE_ALIASES = {"date", "day", "time", "timestamp", "trading date"}


def normalize_header(text: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", " ", str(text).strip()).lower().strip()
    if text in HEADER_MAP:
        return HEADER_MAP[text]
    if text in DATE_ALIASES:
        return "date"
    return text.replace(" ", "_")


def coerce_numeric(series: pd.Series) -> pd.Series:
    cleaned = (
        series.astype(str)
        .str.replace(",", "", regex=False)
        .str.replace("$", "", regex=False)
        .str.replace("%", "", regex=False)
        .str.replace(r"^\((.*)\)$", r"-\1", regex=True)
    )
    return pd.to_numeric(cleaned, errors="coerce")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to the raw StrategyTracker CSV export")
    parser.add_argument("--output", required=True, help="Path to the normalized output CSV")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    df = pd.read_csv(input_path)
    df = df.rename(columns={col: normalize_header(col) for col in df.columns})

    if "date" not in df.columns:
        raise SystemExit("No date-like column was detected in the StrategyTracker export.")

    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    df = df.dropna(subset=["date"]).copy()

    for col in df.columns:
        if col == "date":
            continue
        df[col] = coerce_numeric(df[col])

    numeric_cols = [c for c in df.columns if c != "date" and pd.api.types.is_numeric_dtype(df[c])]
    keep_cols = [
        "date",
        *[
            c
            for c in [
                "mnav_ev",
                "mnav_diluted",
                "mnav_basic",
                "mnav",
                "btc_holdings",
                "mstr_price",
                "btc_price",
                "btc_price_ny_close",
            ]
            if c in numeric_cols
        ],
    ]

    if len(keep_cols) == 1:
        guessed = [c for c in numeric_cols if "mnav" in c]
        keep_cols.extend(guessed)

    if len(keep_cols) == 1:
        raise SystemExit("No usable numeric metric columns were found after normalization.")

    clean = df[keep_cols].sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean.to_csv(output_path, index=False)

    print(f"Wrote {len(clean)} rows to {output_path}")
    print(f"Columns: {', '.join(clean.columns)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
