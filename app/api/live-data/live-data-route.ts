import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function round(n: number, dp: number) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

function toDateStr(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("sv-SE", { timeZone: "America/New_York" });
}

function todayNY(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/New_York" });
}

// Fetch daily close prices from Yahoo Finance for a given ticker
// Returns map of date -> close price
async function fetchYahooDailyPrices(ticker: string, startTs: number): Promise<Map<string, number>> {
  const endTs = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${startTs}&period2=${endTs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo ${ticker} ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { adjclose?: Array<{ adjclose?: number[] }>; quote?: Array<{ close?: number[] }> };
      }>;
    };
  };
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes =
    result?.indicators?.adjclose?.[0]?.adjclose ??
    result?.indicators?.quote?.[0]?.close ??
    [];

  const map = new Map<string, number>();
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const close = closes[i];
    if (ts && close != null && Number.isFinite(close)) {
      map.set(toDateStr(ts), close);
    }
  }
  return map;
}

// MicroStrategy BTC holdings history (approximate, based on public disclosures)
// Maps "YYYY-MM-DD" -> cumulative BTC held as of that date
function getBtcHoldings(date: string): number {
  const milestones: Array<[string, number]> = [
    ["2020-08-11", 21454],
    ["2020-09-15", 38250],
    ["2020-12-21", 70470],
    ["2021-01-22", 70784],
    ["2021-02-24", 90531],
    ["2021-03-12", 91579],
    ["2021-04-05", 91064],
    ["2021-06-21", 105085],
    ["2021-08-24", 108992],
    ["2021-09-13", 114042],
    ["2021-11-29", 121044],
    ["2021-12-30", 124391],
    ["2022-03-31", 129218],
    ["2022-06-30", 129699],
    ["2022-09-30", 130000],
    ["2022-12-31", 132500],
    ["2023-03-31", 140000],
    ["2023-06-30", 152333],
    ["2023-09-30", 158245],
    ["2023-12-31", 189150],
    ["2024-03-31", 214246],
    ["2024-06-30", 226331],
    ["2024-09-30", 252220],
    ["2024-11-18", 331200],
    ["2024-12-01", 402100],
    ["2024-12-09", 423650],
    ["2024-12-16", 439000],
    ["2024-12-23", 444262],
    ["2024-12-30", 446400],
    ["2025-01-06", 450000],
    ["2025-02-01", 471107],
    ["2025-03-01", 499096],
    ["2025-04-01", 528185],
    ["2025-05-01", 553555],
  ];

  let holdings = 21454;
  for (const [ms, btc] of milestones) {
    if (date >= ms) holdings = btc;
    else break;
  }
  return holdings;
}

export async function GET() {
  try {
    // Start from 2025-01-01 to cover the gap between sample data and today
    const startTs = Math.floor(new Date("2025-01-01").getTime() / 1000);

    const [btcPrices, mstrPrices] = await Promise.all([
      fetchYahooDailyPrices("BTC-USD", startTs),
      fetchYahooDailyPrices("MSTR", startTs),
    ]);

    // Current live prices (for today's row)
    const today = todayNY();
    const liveBtc = btcPrices.get(today) ?? [...btcPrices.values()].at(-1) ?? 0;
    const liveMstr = mstrPrices.get(today) ?? [...mstrPrices.values()].at(-1) ?? 0;

    // Constants
    const SHARES_DILUTED = 246_300_000;
    const TOTAL_DEBT = 7_270_000_000;
    const CASH = 50_000_000;

    // Build set of dates we already have from sample CSV (to avoid duplicates)
    let sampleLines: string[] = [];
    try {
      const csvPath = join(process.cwd(), "public", "data", "sample_mstr_mnav_dataset.csv");
      const raw = readFileSync(csvPath, "utf8");
      sampleLines = raw.trim().split("\n").slice(1); // drop header
    } catch {
      // non-fatal
    }

    const sampleDates = new Set(sampleLines.map((l) => l.split(",")[0]?.trim()));

    // Build new rows from 2025-01-01 onwards using real market data
    const allDates = new Set([...btcPrices.keys(), ...mstrPrices.keys()]);
    const newRows: string[] = [];

    for (const date of [...allDates].sort()) {
      if (sampleDates.has(date)) continue; // sample already has this date
      const btc = btcPrices.get(date);
      const mstr = mstrPrices.get(date);
      if (!btc || !mstr) continue;

      const holdings = getBtcHoldings(date);
      const btcNav = holdings * btc;
      const marketCap = SHARES_DILUTED * mstr;
      const ev = marketCap + TOTAL_DEBT - CASH;
      const mnavEv = round(ev / btcNav, 4);
      const mnavDiluted = round(marketCap / btcNav, 4);

      newRows.push(`${date},${mnavEv},${mnavDiluted},${round(mstr, 2)},${round(btc, 2)},${holdings}`);
    }

    const header = "date,mnav_ev,mnav_diluted,mstr_price,btc_price_ny_close,btc_holdings";
    const csv = [header, ...sampleLines, ...newRows].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Btc-Price": String(round(liveBtc, 2)),
        "X-Mstr-Price": String(round(liveMstr, 2)),
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "Failed to fetch live data", detail }, { status: 503 });
  }
}
