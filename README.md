# MSTR mNAV Dashboard · Full project version

This version is designed to satisfy the full assignment workflow:

1. **Data collection** outside the frontend
2. **Daily dataset preparation** for mNAV analysis
3. **Web-based visualization** of daily time-series data
4. **LLM-generated interpretation** of the visible chart
5. **Deployment** to a public URL

The dashboard focuses on **Strategy (MSTR)** and treats **mNAV** as the primary indicator. The recommended primary source for the indicator is a **StrategyTracker export**, with optional supporting data from **Binance** and **Alpha Vantage**.

---

## Project structure

```text
app/                         Next.js app router
components/                  Dashboard UI
lib/                         CSV parsing and fallback analysis helpers
public/data/                 Prepared sample data files
scripts/                     Data collection and preparation scripts
raw/                         Place your raw CSV exports here
docs/                        Architecture notes for the report
```

---

## What this app does

- Loads a prepared daily CSV and auto-detects numeric metrics
- Draws a daily line chart for mNAV or related columns
- Switches between multiple metrics and date windows
- Generates an LLM analysis for the currently visible chart window
- Falls back to a local rule-based analysis when no OpenAI key is configured
- Deploys cleanly to Vercel

---

## Recommended end-to-end workflow

### Option 1: The simplest path

Use StrategyTracker as the primary indicator source.

1. Export the raw StrategyTracker table or chart CSV.
2. Place it in `raw/strategytracker_export.csv`.
3. Normalize it:

```bash
python scripts/normalize_strategytracker_export.py   --input raw/strategytracker_export.csv   --output raw/strategytracker_normalized.csv
```

4. Build a final dataset directly from the normalized export:

```bash
python scripts/build_daily_dataset.py   --strategytracker raw/strategytracker_normalized.csv   --output public/data/mstr_daily_dataset.csv
```

5. Run the frontend and upload `public/data/mstr_daily_dataset.csv`, or modify the app to load that file by default.

### Option 2: A stronger report-friendly path

Normalize StrategyTracker data, then enrich it with BTC and MSTR market data.

1. Normalize the StrategyTracker export:

```bash
python scripts/normalize_strategytracker_export.py   --input raw/strategytracker_export.csv   --output raw/strategytracker_normalized.csv
```

2. Fetch BTC hourly data from Binance:

```bash
python scripts/fetch_binance_btc_hourly.py   --start 2025-01-01   --end 2026-04-01   --output raw/btc_hourly.csv
```

3. Align BTC to New York market close:

```bash
python scripts/align_btc_to_ny_close.py   --input raw/btc_hourly.csv   --output raw/btc_ny_close.csv
```

4. Fetch MSTR daily prices from Alpha Vantage:

```bash
python scripts/fetch_alpha_vantage_mstr_daily.py   --api-key YOUR_ALPHA_VANTAGE_KEY   --output raw/mstr_daily.csv
```

5. Build the final merged dataset:

```bash
python scripts/build_daily_dataset.py   --strategytracker raw/strategytracker_normalized.csv   --btc raw/btc_ny_close.csv   --mstr raw/mstr_daily.csv   --output public/data/mstr_daily_dataset.csv
```

This second path is the one that best matches the assignment language about **public APIs**, **web-based source extraction**, and **aggregating data from multiple sources**.

---

## Python requirements

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The scripts only require `pandas` plus Python standard library modules.

---

## Local frontend setup

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

By default the app loads:

```text
public/data/sample_mstr_mnav_dataset.csv
```

You can replace that file with your own final dataset or upload another CSV in the interface.

---

## LLM setup

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Then fill in:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, the app still works and uses a fallback local analysis.

---

## Expected final CSV format

A minimal file looks like this:

```csv
date,mnav_ev,mnav_diluted
2025-01-02,1.84,1.77
2025-01-03,1.79,1.73
```

A stronger report-ready file looks like this:

```csv
date,mnav_ev,mnav_diluted,mstr_price,btc_price_ny_close,btc_holdings
2025-01-02,1.84,1.77,315.20,94750.00,554000
```

---

## Script descriptions

### `scripts/normalize_strategytracker_export.py`
Converts a raw StrategyTracker export into a clean daily CSV with normalized headers and dates.

### `scripts/fetch_binance_btc_hourly.py`
Downloads BTCUSDT hourly close data from Binance using a public endpoint.

### `scripts/align_btc_to_ny_close.py`
Converts hourly BTC data into one row per New York calendar date using the 4:00 PM ET observation as the aligned BTC price.

### `scripts/fetch_alpha_vantage_mstr_daily.py`
Downloads daily MSTR market data from Alpha Vantage.

### `scripts/build_daily_dataset.py`
Merges the normalized StrategyTracker data with optional BTC and MSTR data into one final CSV for the frontend.

---

## Suggested wording for the report

### Selected indicator
I selected **mNAV** as the main indicator because it captures how richly or cheaply the market values Strategy relative to the Bitcoin value implied by its treasury position.

### Data collection
The project uses a **StrategyTracker export** as the primary source of daily mNAV observations. Supporting market data can be added from **Binance** for BTC prices and **Alpha Vantage** for MSTR daily prices. These sources are normalized and merged into one daily dataset before visualization.

### Relationship with Bitcoin
Changes in BTC price affect the implied Bitcoin NAV, while changes in MSTR market price affect the valuation multiple reflected by mNAV. The dashboard therefore helps visualize when Strategy trades at a richer or lower multiple relative to Bitcoin exposure.

### Website deployment
The frontend is implemented in Next.js and can be deployed to Vercel.

---

## Deploy to Vercel

### Option A: GitHub → Vercel

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add `OPENAI_API_KEY` and `OPENAI_MODEL` in the Vercel project settings.
4. Deploy.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

---

## Important note

The files under `public/data/` are **sample demo files** for interface and pipeline testing. Replace them with your own processed dataset before submission.
