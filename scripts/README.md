# Scripts quick reference

## Normalize raw StrategyTracker export

```bash
python scripts/normalize_strategytracker_export.py   --input raw/strategytracker_export.csv   --output raw/strategytracker_normalized.csv
```

## Fetch BTC hourly data from Binance

```bash
python scripts/fetch_binance_btc_hourly.py   --start 2025-01-01   --end 2026-04-01   --output raw/btc_hourly.csv
```

## Align BTC to New York market close

```bash
python scripts/align_btc_to_ny_close.py   --input raw/btc_hourly.csv   --output raw/btc_ny_close.csv
```

## Fetch MSTR daily prices from Alpha Vantage

```bash
python scripts/fetch_alpha_vantage_mstr_daily.py   --api-key YOUR_ALPHA_VANTAGE_KEY   --output raw/mstr_daily.csv
```

## Build the final frontend dataset

```bash
python scripts/build_daily_dataset.py   --strategytracker raw/strategytracker_normalized.csv   --btc raw/btc_ny_close.csv   --mstr raw/mstr_daily.csv   --output public/data/mstr_daily_dataset.csv
```
