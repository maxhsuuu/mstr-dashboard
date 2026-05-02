export type PointForAnalysis = {
  date: string;
  value: number;
};

export type SeriesSummary = {
  latest: number;
  earliest: number;
  high: number;
  low: number;
  average: number;
  median: number;
  pctChange: number;
  days: number;
  latestDate: string;
  earliestDate: string;
  highDate: string;
  lowDate: string;
};

export function summarizeSeries(points: PointForAnalysis[]): SeriesSummary | null {
  if (!points.length) return null;
  const values = points.map((p) => p.value);
  const sortedValues = [...values].sort((a, b) => a - b);
  const latestPoint = points[points.length - 1];
  const earliestPoint = points[0];
  const highPoint = points.reduce((best, cur) => (cur.value > best.value ? cur : best), points[0]);
  const lowPoint = points.reduce((best, cur) => (cur.value < best.value ? cur : best), points[0]);
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  const mid = Math.floor(sortedValues.length / 2);
  const median =
    sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  const pctChange =
    earliestPoint.value === 0
      ? 0
      : ((latestPoint.value - earliestPoint.value) / earliestPoint.value) * 100;

  return {
    latest: latestPoint.value,
    earliest: earliestPoint.value,
    high: highPoint.value,
    low: lowPoint.value,
    average,
    median,
    pctChange,
    days: points.length,
    latestDate: latestPoint.date,
    earliestDate: earliestPoint.date,
    highDate: highPoint.date,
    lowDate: lowPoint.date,
  };
}

export function buildFallbackAnalysis(
  metric: string,
  summary: SeriesSummary,
  points: PointForAnalysis[]
): string {
  const recent = points.slice(-7);
  const recentTrend =
    recent.length >= 2 ? recent[recent.length - 1].value - recent[0].value : 0;
  const trendWord =
    summary.pctChange > 5 ? "uptrend" : summary.pctChange < -5 ? "downtrend" : "range-bound";
  const recentWord = recentTrend > 0 ? "rising" : recentTrend < 0 ? "softening" : "flat";

  const line1 =
    "Trend overview: The selected series (" +
    metric +
    ") is currently in a " +
    trendWord +
    " over the displayed window. The latest reading is " +
    summary.latest.toFixed(2) +
    " on " +
    summary.latestDate +
    ".";

  const line2 =
    "Extremes and turning points: The window low was " +
    summary.low.toFixed(2) +
    " on " +
    summary.lowDate +
    ", and the window high was " +
    summary.high.toFixed(2) +
    " on " +
    summary.highDate +
    ". The mean level is " +
    summary.average.toFixed(2) +
    " and the median is " +
    summary.median.toFixed(2) +
    ".";

  const line3 =
    "Interpretation: From " +
    summary.earliestDate +
    " to " +
    summary.latestDate +
    ", the series changed by " +
    summary.pctChange.toFixed(2) +
    "%. For mNAV-type indicators, rising values usually mean the market is paying a richer valuation multiple relative to Bitcoin NAV, while falling values point to multiple compression.";

  const line4 =
    "Conclusion: The last " +
    recent.length +
    " observations are " +
    recentWord +
    ". A stronger report can compare this chart with BTC price, MSTR price, treasury purchases, or capital-raising events, but even this standalone view already shows whether valuation has expanded or compressed.";

  return [line1, line2, line3, line4].join("\n\n");
}
