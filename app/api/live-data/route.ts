/**
 * GET /api/live-data
 *
 * Fetches live BTC and MSTR prices, computes today's mNAV,
 * and merges it with the bundled historical CSV so the dashboard
 * always shows an up-to-date dataset without any manual upload.
 *
 * Data sources (free, no API key required):
 *   BTC  → CoinGecko simple price API
 *   MSTR → Yahoo Finance chart API
 */

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

function round(n: number, dp: number) {
  return Math.round(n * 10 ** dp) / 10 ** dp;
}

function todayNY(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/New_York" });
}

async function fetchBtcPrice(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = (await res.json()) as { bitcoin?: { usd?: number } };
  const price = json?.bitcoin?.usd;
  if (!price || !Number.isFinite(price)) throw new Error("BTC price missing");
  return price;
}

async function fetchMstrPrice(): Promise<number> {
  const res = await fetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=5d",
    { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
  );
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
  };
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!price || !Number.isFinite(price)) throw new Error("MSTR price missing");
  return price;
}

function buildCsv(btcPrice: number, mstrPrice: number): string {
  const BTC_HOLDINGS = 553_555;
  const SHARES_DILUTED = 246_300_000;
  const TOTAL_DEBT = 7_270_000_000;
  const CASH = 50_000_000;

  const btcNav = BTC_HOLDINGS * btcPrice;
  const marketCap = SHARES_DILUTED * mstrPrice;
  const ev = marketCap + TOTAL_DEBT - CASH;

  const mnavEv = round(ev / btcNav, 4);
  const mnavDiluted = round(marketCap / btcNav, 4);
  const today = todayNY();

  let historicalLines: string[] = [];
  try {
    const csvPath = join(process.cwd(), "public", "data", "sample_mstr_mnav_dataset.csv");
    const raw = readFileSync(csvPath, "utf8");
    historicalLines = raw
      .trim()
      .split("\n")
      .slice(1)
      .filter((line) => {
        const date = line.split(",")[0]?.trim();
        return date && date !== today;
      });
  } catch {
    // non-fatal
  }

  const header = "date,mnav_ev,mnav_diluted,mstr_price,btc_price_ny_close,btc_holdings";
  const todayRow = `${today},${mnavEv},${mnavDiluted},${round(mstrPrice, 2)},${round(btcPrice, 2)},${BTC_HOLDINGS}`;
  return [header, ...historicalLines, todayRow].join("\n");
}

export async function GET() {
  try {
    const [btcPrice, mstrPrice] = await Promise.all([fetchBtcPrice(), fetchMstrPrice()]);
    const csv = buildCsv(btcPrice, mstrPrice);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Btc-Price": String(btcPrice),
        "X-Mstr-Price": String(mstrPrice),
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "Failed to fetch live data", detail }, { status: 503 });
  }
}
