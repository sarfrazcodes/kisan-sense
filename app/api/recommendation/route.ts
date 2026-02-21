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

  // Determine trend
  const recent = prices.slice(-5);
  const diff = prices.length > 1
    ? ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100
    : 0;

  let recommendation = "";

  if (diff > 1.5) {
    recommendation = `${commodity} prices at ${mandi} are on a strong upward trend, currently at ₹${latest}/quintal — ${changeFromAvg}% above the ${prices.length}-day average of ₹${avg.toFixed(0)}. Buying pressure remains high with consistent price gains. SELL NOW to capture this peak. If storage costs are low, you may hold for 2-3 more days, but watch for reversal signals as prices approach seasonal highs.`;
  } else if (diff < -1.5) {
    recommendation = `${commodity} prices at ${mandi} are declining, currently at ₹${latest}/quintal — ${Math.abs(Number(changeFromAvg))}% below the ${prices.length}-day average of ₹${avg.toFixed(0)}. Increased arrivals or reduced demand may be driving this fall. WAIT before selling — hold stock for 3-5 days to allow the market to stabilize. Monitor daily arrival volumes; if supplies drop, prices typically recover within a week.`;
  } else {
    recommendation = `${commodity} prices at ${mandi} are stable at ₹${latest}/quintal, near the ${prices.length}-day average of ₹${avg.toFixed(0)}. There is no strong signal for an immediate price move. HOLD your stock and monitor daily. A breakout above ₹${(latest * 1.03).toFixed(0)} would be a strong selling signal, while a drop below ₹${(latest * 0.97).toFixed(0)} would suggest selling immediately to minimize losses.`;
  }

  return NextResponse.json({ recommendation });
}
