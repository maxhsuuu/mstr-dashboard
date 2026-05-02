import { buildFallbackAnalysis, summarizeSeries, type PointForAnalysis } from "@/lib/analysis";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      metric?: string;
      points?: PointForAnalysis[];
    };

    const metric = body.metric?.trim() || "mNAV";
    const points = Array.isArray(body.points)
      ? body.points.filter((p) => p && typeof p.date === "string" && typeof p.value === "number")
      : [];

    if (points.length < 2) {
      return Response.json({ error: "At least two data points are required." }, { status: 400 });
    }

    const summary = summarizeSeries(points);
    if (!summary) {
      return Response.json({ error: "Unable to summarize the selected series." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ analysis: buildFallbackAnalysis(metric, summary, points), mode: "fallback" });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const sampled = points.length > 180
      ? points.filter((_, index) => index % Math.ceil(points.length / 180) === 0)
      : points;

    const prompt = [
      "You are analyzing a daily time-series chart for a student dashboard project about Strategy (MSTR) and Bitcoin treasury valuation metrics.",
      "Selected metric: " + metric + ".",
      "Write a concise analysis in plain English using exactly four sections with these headings:",
      "Trend overview",
      "Extremes and turning points",
      "Interpretation for MSTR valuation",
      "Bottom-line conclusion",
      "Do not invent external events or quote news. Use only the supplied numbers.",
      "Summary: " + JSON.stringify(summary),
      "Sampled points: " + JSON.stringify(sampled),
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({ model, input: prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        {
          analysis: buildFallbackAnalysis(metric, summary, points),
          mode: "fallback",
          warning: "OpenAI API request failed: " + errorText,
        },
        { status: 200 }
      );
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };

    const text =
      data.output_text?.trim() ||
      data.output
        ?.flatMap((item) => item.content || [])
        .find((c) => c.type === "output_text" && c.text)
        ?.text?.trim() ||
      buildFallbackAnalysis(metric, summary, points);

    return Response.json({ analysis: text, mode: "openai" });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown server error." },
      { status: 500 }
    );
  }
}
