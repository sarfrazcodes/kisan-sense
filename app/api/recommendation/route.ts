import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prices, weather, commodity } = await req.json();

  try {
    const prompt = `
You are an agricultural market analyst.

Commodity: ${commodity}
Recent modal prices: ${prices.join(", ")}
Average temperature: ${weather?.temp}
Rain probability: ${weather?.rainProbability}%

Give:
1. SELL NOW, HOLD, or WAIT
2. 2-line reasoning
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await geminiResponse.json();

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No insight";

    return NextResponse.json({ recommendation: text });
  } catch (err) {
    return NextResponse.json({ error: "AI failed" }, { status: 500 });
  }
}