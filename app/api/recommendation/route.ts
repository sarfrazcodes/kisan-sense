import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash"; // Switch from 1.5 to 2.0

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prices, weather, commodity, mandi } = body;

    if (!prices || prices.length === 0) {
      return NextResponse.json({ recommendation: "No price data available to analyze." });
    }

    // ── Build detailed prompt ──
    const latest = prices[prices.length - 1];
    const avg = (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const priceChange = prices.length > 1
      ? (((latest - prices[0]) / prices[0]) * 100).toFixed(1)
      : "0";

    const weatherContext = weather
      ? `Current weather: ${weather.description || weather.condition || "N/A"}, Temperature: ${weather.temp || weather.temperature || "N/A"}°C, Rain probability: ${weather.rainProbability || weather.rain_probability || weather.precipitation || "N/A"}%.`
      : "Weather data is unavailable for this location.";

    const prompt = `You are an expert agricultural market analyst specializing in Indian commodity markets. A farmer needs your advice.

MARKET DATA:
- Commodity: ${commodity}
- Mandi (Market): ${mandi}
- Current Price: ₹${latest}/quintal
- Price over last ${prices.length} days: ${prices.map((p: number) => `₹${p}`).join(", ")}
- Average Price: ₹${avg}/quintal
- Price Range: ₹${min} – ₹${max}/quintal
- Overall Change: ${priceChange}% over ${prices.length} days

WEATHER CONDITIONS:
${weatherContext}

INSTRUCTIONS:
Provide a detailed 3-4 sentence market analysis covering:
1. Current price trend (rising/falling/stable) with specific numbers
2. How weather conditions may impact supply, transport, or demand
3. A clear recommendation: SELL NOW, WAIT, or HOLD — with specific reasoning
4. Expected price movement in the next 3-5 days with an estimated price range

Be specific, use the actual numbers provided, and write in a helpful advisory tone for an Indian farmer. Keep it under 120 words.`;

    // ── Call Gemini API ──
    if (!GEMINI_API_KEY) {
      console.warn("⚠ GEMINI_API_KEY not set — using rule-based fallback");
      return ruleBasedFallback(prices, commodity, mandi);
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
            topP: 0.9,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("❌ Gemini API error:", geminiRes.status, errText);
      return ruleBasedFallback(prices, commodity, mandi);
    }

    const geminiData = await geminiRes.json();
    console.log("🤖 Gemini raw response:", JSON.stringify(geminiData, null, 2));

    const recommendation =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      geminiData?.candidates?.[0]?.content?.text ||
      "";

    if (!recommendation) {
      console.warn("⚠ Gemini returned empty text — using fallback");
      return ruleBasedFallback(prices, commodity, mandi);
    }

    return NextResponse.json({ recommendation: recommendation.trim() });

  } catch (err) {
    console.error("❌ Recommendation route error:", err);
    return NextResponse.json({
      recommendation: "Market analysis temporarily unavailable. Please check prices manually and consult your local mandi.",
    });
  }
}

// ── Rule-based fallback when Gemini is unavailable ──
function ruleBasedFallback(prices: number[], commodity: string, mandi: string) {
  const latest = prices[prices.length - 1];
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const changeFromAvg = (((latest - avg) / avg) * 100).toFixed(1);

  // Determine PREDICTED price trend using linear regression
  const n = prices.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = prices.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * prices[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const predictedPrice = intercept + slope * n;
  const expectedGain = predictedPrice - latest;
  const expectedGainPct = ((expectedGain / latest) * 100).toFixed(1);

  let recommendation = "";

  // Recommendation based on EXPECTED GAIN (predicted future price)
  if (expectedGain > 50) {
    // Prices expected to rise significantly
    recommendation = `${commodity} prices at ${mandi} are expected to rise significantly, currently at ₹${latest}/quintal. Our forecast predicts prices will reach ₹${Math.round(predictedPrice)}/quintal within 3-5 days — a potential gain of ₹${expectedGain.toFixed(0)}/quintal (${expectedGainPct}%). WAIT before selling — hold stock to capture the expected price increase. Monitor market conditions daily, but the trend is favorable.`;
  } else if (expectedGain > 10) {
    // Prices expected to rise moderately
    recommendation = `${commodity} prices at ${mandi} show a positive outlook, currently at ₹${latest}/quintal. Our forecast suggests a modest increase to ₹${Math.round(predictedPrice)}/quintal in the next 3-5 days, representing a potential gain of ₹${expectedGain.toFixed(0)}/quintal (${expectedGainPct}%). HOLD your stock for now — prices are trending favorably. A minor dip may occur, but the overall direction is positive.`;
  } else if (expectedGain > -10) {
    // Prices expected to remain relatively stable
    recommendation = `${commodity} prices at ${mandi} are relatively stable at ₹${latest}/quintal, with minimal expected change. Our forecast indicates prices will hover around ₹${Math.round(predictedPrice)}/quintal over the next 3-5 days. HOLD your stock and monitor daily movements. No urgent need to sell, but watch for any sudden shifts in market sentiment or supply conditions.`;
  } else if (expectedGain > -50) {
    // Prices expected to decline moderately
    recommendation = `${commodity} prices at ${mandi} are showing signs of decline, currently at ₹${latest}/quintal. Our forecast predicts prices may drop to ₹${Math.round(predictedPrice)}/quintal within 3-5 days — a potential loss of ₹${Math.abs(expectedGain).toFixed(0)}/quintal (${expectedGainPct}%). We recommend WAITING for 2-3 days to see if the decline stabilizes. Monitor arrival volumes; if supplies decrease, prices often recover.`;
  } else {
    // Prices expected to fall significantly
    recommendation = `${commodity} prices at ${mandi} are under significant downward pressure, currently at ₹${latest}/quintal. Our forecast suggests prices could fall to ₹${Math.round(predictedPrice)}/quintal within 3-5 days — a potential loss of ₹${Math.abs(expectedGain).toFixed(0)}/quintal (${expectedGainPct}%). SELL NOW to minimize losses. Market conditions appear unfavorable in the short term.`;
  }

  return NextResponse.json({ recommendation });
}