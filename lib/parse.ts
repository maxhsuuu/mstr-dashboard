import Papa from "papaparse";

export type ParsedPoint = {
  date: string;
  values: Record<string, number>;
};

export type ParsedCSV = {
  points: ParsedPoint[];
  metrics: string[];
  defaultMetric: string | null;
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseNumeric(input: unknown): number | null {
  if (input == null) return null;
  const value = String(input).trim();
  if (!value) return null;

  const cleaned = value
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/[xX]$/, "")
    .replace(/^\((.*)\)$/, "-$1");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function inferDate(row: Record<string, unknown>): string | null {
  const preferredKeys = ["date", "day", "time", "timestamp", "trading_date"];
  for (const key of Object.keys(row)) {
    const normalized = normalizeHeader(key);
    if (!preferredKeys.includes(normalized)) continue;
    const raw = row[key];
    if (!raw) continue;
    const date = new Date(String(raw));
    if (Number.isNaN(date.getTime())) continue;
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function inferMetricOrder(metrics: string[]): string[] {
  const priority = [
    "mnav_ev",
    "mnav_diluted",
    "mnav_basic",
    "mnav",
    "market_cap",
    "enterprise_value",
    "mstr_price",
    "btc_price_ny_close",
    "btc_price",
    "btc_holdings",
  ];

  return [...metrics].sort((a, b) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export function parseCsvText(text: string): ParsedCSV {
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    throw new Error(parsed.errors[0]?.message || "Failed to parse CSV.");
  }

  const points: ParsedPoint[] = [];
  const metricSet = new Set<string>();

  for (const row of parsed.data) {
    const date = inferDate(row);
    if (!date) continue;

    const values: Record<string, number> = {};

    for (const [key, rawValue] of Object.entries(row)) {
      const normalized = normalizeHeader(key);
      if (["date", "day", "time", "timestamp", "trading_date"].includes(normalized)) continue;
      const value = parseNumeric(rawValue);
      if (value == null) continue;
      values[normalized] = value;
      metricSet.add(normalized);
    }

    if (Object.keys(values).length > 0) {
      points.push({ date, values });
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  const metrics = inferMetricOrder([...metricSet]);
  const defaultMetric = metrics.find((metric) => metric.includes("mnav")) ?? metrics[0] ?? null;

  return { points, metrics, defaultMetric };
}
