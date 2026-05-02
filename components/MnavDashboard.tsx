"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseCsvText, type ParsedPoint } from "@/lib/parse";
import { summarizeSeries } from "@/lib/analysis";

type RangeKey = "30D" | "90D" | "180D" | "1Y" | "ALL";
type ChartRow = { date: string; value: number };

const RANGE_MAP: Record<RangeKey, number | null> = {
  "30D": 30,
  "90D": 90,
  "180D": 180,
  "1Y": 365,
  "ALL": null,
};

function formatMetricName(metric: string) {
  return metric
    .replace(/_/g, " ")
    .replace(/\bbtc\b/gi, "BTC")
    .replace(/\bmstr\b/gi, "MSTR")
    .replace(/\bmnav\b/gi, "mNAV")
    .replace(/\bny\b/gi, "NY")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function buildRows(points: ParsedPoint[], metric: string): ChartRow[] {
  return points
    .filter((point) => typeof point.values[metric] === "number")
    .map((point) => ({ date: point.date, value: point.values[metric] }));
}

export function MnavDashboard() {
  const [points, setPoints] = useState<ParsedPoint[]>([]);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [metric, setMetric] = useState<string>("");
  const [range, setRange] = useState<RangeKey>("180D");
  const [status, setStatus] = useState<string>("Load the prepared sample dataset or upload your own processed CSV.");
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisMode, setAnalysisMode] = useState<string>("");
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadedSource, setLoadedSource] = useState<string>("prepared demo dataset");
  const [liveStatus, setLiveStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [liveTimestamp, setLiveTimestamp] = useState<string>("");

  async function loadCsvText(text: string, sourceLabel: string) {
    try {
      const parsed = parseCsvText(text);
      if (parsed.points.length === 0 || parsed.metrics.length === 0 || !parsed.defaultMetric) {
        throw new Error("No usable date + metric columns were detected in this CSV.");
      }
      setPoints(parsed.points);
      setMetrics(parsed.metrics);
      setMetric(parsed.defaultMetric);
      setAnalysis("");
      setAnalysisMode("");
      setLoadedSource(sourceLabel);
      setError("");
      setStatus(`Loaded ${parsed.points.length} rows from ${sourceLabel}. Default metric: ${formatMetricName(parsed.defaultMetric)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV.");
    }
  }

  useEffect(() => {
    void (async () => {
      // 1. Try live data first (fetches real BTC + MSTR prices on page load)
      setLiveStatus("loading");
      setStatus("Fetching live MSTR and BTC data…");
      try {
        const liveRes = await fetch("/api/live-data");
        if (liveRes.ok) {
          const text = await liveRes.text();
          const btcPrice = liveRes.headers.get("X-Btc-Price");
          const mstrPrice = liveRes.headers.get("X-Mstr-Price");
          const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          setLiveTimestamp(now);
          setLiveStatus("success");
          await loadCsvText(text, `live data (fetched at ${now})`);
          if (btcPrice && mstrPrice) {
            setStatus(
              `Live data loaded at ${now} · BTC $${Number(btcPrice).toLocaleString("en-US", { maximumFractionDigits: 0 })} · MSTR $${Number(mstrPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
            );
          }
          return;
        }
      } catch {
        // Live fetch failed — fall through to bundled sample
      }

      // 2. Fall back to bundled sample dataset
      setLiveStatus("error");
      try {
        const response = await fetch("/data/sample_mstr_mnav_dataset.csv");
        const text = await response.text();
        await loadCsvText(text, "the prepared sample dataset (live fetch unavailable)");
        setStatus("Could not reach live data APIs. Showing bundled sample dataset.");
      } catch {
        setError("Could not load the prepared sample dataset.");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allRows = useMemo(() => (metric ? buildRows(points, metric) : []), [points, metric]);

  const visibleRows = useMemo(() => {
    const days = RANGE_MAP[range];
    if (!days || allRows.length <= days) return allRows;
    return allRows.slice(-days);
  }, [allRows, range]);

  const summary = useMemo(() => summarizeSeries(visibleRows), [visibleRows]);

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await loadCsvText(text, file.name);
    event.currentTarget.value = "";
  }

  async function refreshLiveData() {
    setLiveStatus("loading");
    setStatus("Refreshing live data…");
    setError("");
    try {
      const liveRes = await fetch("/api/live-data");
      if (!liveRes.ok) throw new Error(`API returned ${liveRes.status}`);
      const text = await liveRes.text();
      const btcPrice = liveRes.headers.get("X-Btc-Price");
      const mstrPrice = liveRes.headers.get("X-Mstr-Price");
      const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      setLiveTimestamp(now);
      setLiveStatus("success");
      await loadCsvText(text, `live data (fetched at ${now})`);
      if (btcPrice && mstrPrice) {
        setStatus(
          `Live data refreshed at ${now} · BTC $${Number(btcPrice).toLocaleString("en-US", { maximumFractionDigits: 0 })} · MSTR $${Number(mstrPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
        );
      }
    } catch (err) {
      setLiveStatus("error");
      setError(err instanceof Error ? err.message : "Live refresh failed.");
    }
  }

  async function loadPreparedDemo() {
    const response = await fetch("/data/sample_mstr_mnav_dataset.csv");
    const text = await response.text();
    await loadCsvText(text, "the prepared sample dataset");
  }

  async function requestAnalysis() {
    if (visibleRows.length < 2) return;
    setLoadingAnalysis(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, points: visibleRows }),
      });
      const data = (await response.json()) as { analysis?: string; mode?: string; error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error || "Analysis request failed.");
      setAnalysis(data.analysis || "No analysis returned.");
      setAnalysisMode(data.mode || "unknown");
      if (data.warning) setStatus(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze chart.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero">
          <div className="eyebrow">Strategy (MSTR) · Daily mNAV project</div>
          <h1>MSTR mNAV dashboard with data collection scripts, daily charting, and LLM commentary</h1>
          <p className="lead">
            This version is built to match your assignment more closely: collect data outside the app, prepare a daily dataset,
            upload or serve the processed CSV, and let the dashboard visualize the series and generate a chart-based summary.
          </p>
          <div className="badges">
            <span className="badge">mNAV as the main indicator</span>
            <span className="badge">Daily time-series visualization</span>
            <span className="badge">LLM analysis for the visible window</span>
            <span className="badge warning">Deploy-ready on Vercel</span>
          </div>
        </section>

        <section className="grid grid-2">
          <div className="card">
            <h2 className="section-title">1. Data input</h2>
            <p className="muted">
              Live data is fetched automatically on page load from CoinGecko (BTC price) and Yahoo Finance (MSTR price).
              The dashboard merges this with historical data so you always see up-to-date mNAV values.
            </p>

            {/* Live data status banner */}
            <div className="callout" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className={`badge ${liveStatus === "success" ? "" : liveStatus === "error" ? "warning" : ""}`}>
                {liveStatus === "loading" && "⏳ Fetching live data…"}
                {liveStatus === "success" && `✅ Live · updated ${liveTimestamp}`}
                {liveStatus === "error" && "⚠️ Live fetch failed — using sample"}
                {liveStatus === "idle" && "● Initialising…"}
              </span>
              <button
                className="btn secondary"
                onClick={refreshLiveData}
                disabled={liveStatus === "loading"}
                style={{ marginLeft: "auto" }}
              >
                {liveStatus === "loading" ? "Fetching…" : "↻ Refresh live data"}
              </button>
            </div>

            <div className="controls" style={{ marginBottom: 16 }}>
              <label className="control-group">
                <span className="label">Upload your own CSV</span>
                <input className="file" type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
              </label>
              <button className="btn secondary" onClick={loadPreparedDemo}>Load bundled sample</button>
            </div>
            <div className="callout">
              <strong>Expected columns</strong>
              <ul className="mini-list" style={{ marginTop: 8 }}>
                <li><span className="code">date</span> plus at least one numeric metric column</li>
                <li>Best practice: <span className="code">mnav_ev</span> or <span className="code">mnav_diluted</span></li>
                <li>Optional enrichment: <span className="code">btc_price_ny_close</span>, <span className="code">mstr_price</span>, <span className="code">btc_holdings</span></li>
              </ul>
            </div>
            <div className="status">Current source: <span className="code">{loadedSource}</span></div>
            {status && <p className="status">{status}</p>}
            {error && <p className="error">{error}</p>}
          </div>

          <div className="card">
            <h2 className="section-title">2. Assignment fit</h2>
            <ul className="list">
              <li><strong>Data Collection:</strong> use the Python scripts to normalize a StrategyTracker export and optionally join BTC / MSTR market data.</li>
              <li><strong>Indicator Analysis:</strong> mNAV is the primary series; supplementary metrics can be plotted from the same CSV.</li>
              <li><strong>Web Visualization:</strong> the dashboard displays a daily line chart with selectable windows.</li>
              <li><strong>AI Summary:</strong> the visible chart can be sent to an LLM or a local fallback analyzer.</li>
              <li><strong>Deployment:</strong> the app is structured for a straightforward Vercel deployment.</li>
            </ul>
            <hr className="divider" />
            <p className="muted">
              Suggested report sentence: <span className="code">The dashboard uses StrategyTracker-exported mNAV data as the primary indicator and aggregates supplementary BTC and MSTR market data into a daily dataset for visualization and LLM-based interpretation.</span>
            </p>
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <div className="controls" style={{ marginBottom: 16 }}>
            <label className="control-group">
              <span className="label">Metric</span>
              <select className="select" value={metric} onChange={(e) => setMetric(e.target.value)} disabled={!metrics.length}>
                {metrics.map((item) => (
                  <option key={item} value={item}>{formatMetricName(item)}</option>
                ))}
              </select>
            </label>
            <label className="control-group">
              <span className="label">Display window</span>
              <select className="select" value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
                {Object.keys(RANGE_MAP).map((key) => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
            </label>
            <div className="control-group">
              <span className="label">LLM analysis</span>
              <button className="btn" onClick={requestAnalysis} disabled={loadingAnalysis || visibleRows.length < 2}>
                {loadingAnalysis ? "Analyzing..." : "Analyze visible chart"}
              </button>
            </div>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleRows} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.09)" vertical={false} />
                <XAxis dataKey="date" minTickGap={24} stroke="#9fb1d1" />
                <YAxis stroke="#9fb1d1" width={90} tickFormatter={(value) => formatNumber(Number(value))} />
                <Tooltip
                  contentStyle={{
                    background: "#10192d",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 14,
                    color: "#edf2ff",
                  }}
                  formatter={(value) => formatNumber(Number(value))}
                />
                <Line type="monotone" dataKey="value" stroke="#7cc7ff" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid grid-2" style={{ marginTop: 16 }}>
          <div className="card">
            <h2 className="section-title">3. Visible-window summary</h2>
            {!summary ? (
              <p className="muted">Upload a prepared CSV to begin.</p>
            ) : (
              <>
                <div className="kpi-grid">
                  <div className="kpi">
                    <div className="name">Latest</div>
                    <div className="value">{formatNumber(summary.latest)}</div>
                    <div className="sub">{summary.latestDate}</div>
                  </div>
                  <div className="kpi">
                    <div className="name">Average</div>
                    <div className="value">{formatNumber(summary.average)}</div>
                    <div className="sub">Visible window</div>
                  </div>
                  <div className="kpi">
                    <div className="name">High / Low</div>
                    <div className="value">{formatNumber(summary.high)} / {formatNumber(summary.low)}</div>
                    <div className="sub">{summary.highDate} / {summary.lowDate}</div>
                  </div>
                  <div className="kpi">
                    <div className="name">Change</div>
                    <div className="value">{summary.pctChange.toFixed(2)}%</div>
                    <div className="sub">{summary.days} observations</div>
                  </div>
                </div>
                <div style={{ marginTop: 18 }}>
                  <ul className="list">
                    <li>Current metric: <span className="code">{formatMetricName(metric)}</span></li>
                    <li>Displayed observations: {summary.days}</li>
                    <li>Start date: {summary.earliestDate}</li>
                    <li>End date: {summary.latestDate}</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h2 className="section-title">4. LLM / fallback interpretation</h2>
            <div className="controls-inline" style={{ marginBottom: 12 }}>
              <span className="badge">Mode: {analysisMode || "not run yet"}</span>
              <span className="badge">Input = currently visible chart window</span>
            </div>
            {analysis ? (
              <div className="analysis">{analysis}</div>
            ) : (
              <p className="muted">Click <strong>Analyze visible chart</strong> to generate a chart-based explanation and conclusion.</p>
            )}
          </div>
        </section>

        <section className="grid grid-3" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Pipeline A · Normalize StrategyTracker export</h3>
            <p className="muted">Use the script to convert a raw export into a clean daily CSV with normalized headers such as <span className="code">date</span>, <span className="code">mnav_ev</span>, and <span className="code">mnav_diluted</span>.</p>
            <p className="code">python scripts/normalize_strategytracker_export.py --input raw/strategytracker_export.csv --output raw/strategytracker_normalized.csv</p>
          </div>
          <div className="card">
            <h3>Pipeline B · Fetch supporting market data</h3>
            <p className="muted">Optional scripts fetch BTC data from Binance and MSTR daily prices from Alpha Vantage, so your project can document API-based data collection.</p>
            <p className="code">python scripts/fetch_binance_btc_hourly.py ...</p>
          </div>
          <div className="card">
            <h3>Pipeline C · Build the final dataset</h3>
            <p className="muted">Merge normalized mNAV data with BTC / MSTR data into one file. Then either upload it in the UI or place it in <span className="code">public/data</span>.</p>
            <p className="code">python scripts/build_daily_dataset.py --strategytracker raw/strategytracker_normalized.csv --btc raw/btc_ny_close.csv --mstr raw/mstr_daily.csv --output public/data/mstr_daily_dataset.csv</p>
          </div>
        </section>

        <p className="footer">
          The bundled sample files are for interface testing only. Replace them with your own processed dataset before submission.
        </p>
      </div>
    </main>
  );
}
