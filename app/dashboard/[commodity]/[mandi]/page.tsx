"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import { linearRegressionForecast } from "@/lib/intelligence/forecastEngine";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface PriceRow {
  modal_price: number;
  min_price: number;
  max_price: number;
  arrival_quantity: number | null;
  date: string;
}

interface WeatherData {
  // Support multiple possible field shapes from /api/weather
  temp?: number;
  temperature?: number;
  rainProbability?: number;
  rain_probability?: number;
  precipitation?: number;
  description?: string;
  condition?: string;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getTrend(prices: number[]): "up" | "down" | "flat" {
  if (prices.length < 2) return "flat";
  const recent = prices.slice(-5);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = ((last - first) / first) * 100;
  if (diff > 1.5) return "up";
  if (diff < -1.5) return "down";
  return "flat";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

function getWeatherTemp(w: WeatherData): number | null {
  return w.temp ?? w.temperature ?? null;
}

function getWeatherRain(w: WeatherData): number | null {
  return w.rainProbability ?? w.rain_probability ?? w.precipitation ?? null;
}

function getVolatilityStyle(label: string): string {
  if (label === "High") return "text-red-600 bg-red-50 border-red-200";
  if (label === "Moderate") return "text-yellow-700 bg-yellow-50 border-yellow-200";
  return "text-green-700 bg-green-50 border-green-200";
}

function getRecommendationStyle(action: string): {
  bg: string;
  border: string;
  badge: string;
  text: string;
} {
  const u = action.toUpperCase();
  if (u.includes("SELL"))
    return { bg: "bg-emerald-50", border: "border-emerald-300", badge: "bg-emerald-600 text-white", text: "text-emerald-800" };
  if (u.includes("WAIT"))
    return { bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-500 text-white", text: "text-orange-800" };
  return { bg: "bg-blue-50", border: "border-blue-300", badge: "bg-blue-600 text-white", text: "text-blue-800" };
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function DashboardPage() {
  const t = useT();
  const params = useParams();
  console.log("Route Params:", params);

  const commodityId = params.commodity as string;
  const mandiId = params.mandi as string;
  console.log("commodityId:", commodityId, "| mandiId:", mandiId);

  // ── State ──
  const [commodityName, setCommodityName] = useState("");
  const [mandiName, setMandiName] = useState("");
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [prices, setPrices] = useState<number[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [recommendation, setRecommendation] = useState<string>("");
  const [recommendationAction, setRecommendationAction] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // ─────────────────────────────────────────────
  // FETCH CORE DATA
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!commodityId || commodityId === "undefined") {
      console.error("❌ commodityId missing:", commodityId);
      setLoading(false);
      return;
    }
    if (!mandiId || mandiId === "undefined") {
      console.error("❌ mandiId missing:", mandiId);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      console.log("🚀 Loading Dashboard:", { commodityId, mandiId });

      // 1. Commodity
      const { data: commodity, error: commodityError } = await supabase
        .from("commodities")
        .select("name")
        .eq("id", commodityId)
        .single();
      if (commodityError) console.error("❌ Commodity error:", commodityError);
      if (commodity) {
        console.log("✅ Commodity:", commodity.name);
        setCommodityName(commodity.name);
      }

      // 2. Mandi
      const { data: mandi, error: mandiError } = await supabase
        .from("mandis")
        .select("name")
        .eq("id", mandiId)
        .single();
      if (mandiError) console.error("❌ Mandi error:", mandiError);
      if (mandi) {
        console.log("✅ Mandi:", mandi.name);
        setMandiName(mandi.name);

        // 3. Weather — clean city name before sending (strip APMC, brackets, market suffixes)
        try {
          const cleanCity = mandi.name
            .replace(/\(.*?\)/g, "")        // Remove (Uzhavar Sandhai), (Veg. Market), etc.
            .replace(/\bAPMC\b/gi, "")      // Remove APMC
            .replace(/\bMandi\b/gi, "")     // Remove Mandi
            .replace(/\bMarket\b/gi, "")    // Remove Market
            .replace(/\bF&V\b/gi, "")       // Remove F&V
            .replace(/\bVeg\.?\b/gi, "")    // Remove Veg
            .replace(/\bSandhai\b/gi, "")   // Remove Sandhai
            .replace(/[-_]+/g, " ")         // Replace dashes/underscores with space
            .replace(/\s+/g, " ")           // Collapse multiple spaces
            .trim();
          console.log(`🌦 Weather city: "${cleanCity}" (raw: "${mandi.name}")`);
          const res = await fetch(`/api/weather?location=${encodeURIComponent(cleanCity)}`);
          const weatherData = await res.json();
          if (!res.ok || weatherData.error) {
            throw new Error(`Weather API error: ${weatherData.error || res.status}`);
          }
          console.log("🌦 Weather data:", weatherData);
          setWeather(weatherData);
        } catch (err) {
          console.warn("⚠ Weather failed:", err);
          setWeatherError(true);
        }
      }

      // 4. Price History — fetch all needed columns
      console.log("📡 Fetching price_history...");
      const { data: priceData, error: priceError } = await supabase
        .from("price_history")
        .select("modal_price, min_price, max_price, arrival_quantity, date")
        .eq("commodity_id", commodityId)
        .eq("mandi_id", mandiId)
        .order("date", { ascending: true })
        .limit(30);

      if (priceError) console.error("❌ Price history error:", priceError);
      console.log("📊 Raw price data:", priceData);
      console.log("📊 Row count:", priceData?.length ?? 0);

      if (priceData && priceData.length > 0) {
        const rows: PriceRow[] = priceData.map((row) => ({
          modal_price: Number(row.modal_price),
          min_price: Number(row.min_price),
          max_price: Number(row.max_price),
          arrival_quantity: row.arrival_quantity != null ? Number(row.arrival_quantity) : null,
          date: row.date,
        }));
        const modalPrices = rows.map((r) => r.modal_price);
        console.log("📈 Extracted modal prices:", modalPrices);
        console.log("📈 Price count:", modalPrices.length);
        setPriceRows(rows);
        setPrices(modalPrices);
        setLastUpdated(rows[rows.length - 1].date);
      } else {
        console.warn("⚠ No price rows found for these IDs");
      }

      setLoading(false);
    };

    fetchData();
  }, [commodityId, mandiId]);

  // ─────────────────────────────────────────────
  // AI RECOMMENDATION (non-blocking)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!commodityName || prices.length === 0) return;

    const fetchRecommendation = async () => {
      setAiLoading(true);
      try {
        const res = await fetch("/api/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prices, weather, commodity: commodityName, mandi: mandiName }),
        });
        if (!res.ok) throw new Error(`AI API ${res.status}`);
        const data = await res.json();
        console.log("🤖 AI raw response:", data);
        console.log("🤖 AI response keys:", Object.keys(data));
        console.log("🤖 AI response stringified:", JSON.stringify(data));

        // Exhaustively try every possible field name / nested shape
        const fullText: string =
          data.recommendation ||
          data.insight ||
          data.message ||
          data.text ||
          data.result ||
          data.output ||
          data.response ||
          data.content ||
          data.answer ||
          data.analysis ||
          // Handle nested: { data: { recommendation: "..." } }
          data?.data?.recommendation ||
          data?.data?.insight ||
          data?.data?.message ||
          // Handle Gemini direct response shape
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "";

        console.log("🤖 Extracted text:", fullText);

        if (!fullText) {
          // Last resort: stringify the whole object as insight
          console.warn("⚠ AI: Could not find text in response. Keys were:", Object.keys(data));
        }

        // Extract action keyword from response text
        const upper = fullText.toUpperCase();
        if (upper.includes("SELL NOW")) setRecommendationAction("SELL NOW");
        else if (upper.includes("SELL")) setRecommendationAction("SELL NOW");
        else if (upper.includes("WAIT")) setRecommendationAction("WAIT");
        else if (upper.includes("HOLD")) setRecommendationAction("HOLD");
        else if (fullText) setRecommendationAction("MONITOR");

        setRecommendation(
          fullText || "Market conditions are stable. Monitor price movement over the next 2–3 days."
        );
      } catch (err) {
        console.warn("⚠ AI failed, using rule-based fallback:", err);
        // Deterministic fallback based on trend
        const trend = getTrend(prices);
        if (trend === "up") {
          setRecommendationAction("SELL NOW");
          setRecommendation(
            "Prices are trending upward. Consider selling at current market rates to maximize returns."
          );
        } else if (trend === "down") {
          setRecommendationAction("WAIT");
          setRecommendation(
            "Prices are declining. Consider waiting for market stabilization before selling."
          );
        } else {
          setRecommendationAction("HOLD");
          setRecommendation(
            "Market prices are stable. Monitor for 2–3 more days before making a decision."
          );
        }
      } finally {
        setAiLoading(false);
      }
    };

    fetchRecommendation();
  }, [prices, weather, commodityName, mandiName]);

  // ─────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">{t("Loading market intelligence...")}</p>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────
  // NO DATA FALLBACK
  // ─────────────────────────────────────────────
  if (prices.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">{t("No Price Data Available")}</h1>
          <p className="text-gray-600 mb-4">
            {t("No price history found for")} <strong>{commodityName || commodityId}</strong> {t("at")}{" "}
            <strong>{mandiName || mandiId}</strong>.
          </p>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-1">
            <p><strong>Commodity ID:</strong> {commodityId}</p>
            <p><strong>Mandi ID:</strong> {mandiId}</p>
            <p className="mt-2 text-gray-500">
              Verify rows exist in{" "}
              <code className="bg-gray-100 px-1 rounded">price_history</code> with columns{" "}
              <code className="bg-gray-100 px-1 rounded">modal_price</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">min_price</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">max_price</code>,{" "}
              <code className="bg-gray-100 px-1 rounded">date</code>. Check browser console for details.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────
  // CALCULATIONS
  // ─────────────────────────────────────────────
  const latestRow = priceRows[priceRows.length - 1];
  const currentPrice = latestRow.modal_price;
  const currentMin = latestRow.min_price;
  const currentMax = latestRow.max_price;
  const currentQty = latestRow.arrival_quantity;

  const predictedPrice = prices.length > 1 ? linearRegressionForecast(prices) : currentPrice;
  const expectedGain = predictedPrice - currentPrice;
  const expectedGainPct = ((expectedGain / currentPrice) * 100).toFixed(2);

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance =
    prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance);
  let volatilityLabel = "Low";
  if (volatility > 150) volatilityLabel = "High";
  else if (volatility > 50) volatilityLabel = "Moderate";

  const trend = getTrend(prices);
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-gray-500";
  const trendLabel = trend === "up" ? "Rising" : trend === "down" ? "Falling" : "Stable";

  const chartData = priceRows.map((row) => ({
    date: formatDate(row.date),
    price: row.modal_price,
  }));

  const weatherTemp = weather ? getWeatherTemp(weather) : null;
  const weatherRain = weather ? getWeatherRain(weather) : null;
  const weatherDesc = weather?.description || weather?.condition || null;

  const recStyle = getRecommendationStyle(recommendationAction);
  const volStyle = getVolatilityStyle(volatilityLabel);

  // ─────────────────────────────────────────────
  // FULL DASHBOARD UI
  // ─────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── 1. MARKET CONTEXT HEADER ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                {t("KisanSense Intelligence")}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                {commodityName}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">📍 {mandiName}</p>
            </div>
            <div className="text-sm text-right space-y-1">
              {lastUpdated && (
                <p className="text-gray-400">
                  {t("Last updated")}: {" "}
                  <span className="text-gray-700 font-medium">{formatDate(lastUpdated)}</span>
                </p>
              )}
              <p className="text-gray-400">
                {t("Trend")}: {" "}
                <span className={`font-bold text-base ${trendColor}`}>
                  {trendIcon} {trendLabel}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. CURRENT PRICE CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("Modal Price"), value: `₹${currentPrice.toLocaleString("en-IN")}`, sub: t("per quintal"), color: "text-gray-900" },
            { label: t("Min Price"), value: `₹${currentMin.toLocaleString("en-IN")}`, sub: t("today's floor"), color: "text-blue-600" },
            { label: t("Max Price"), value: `₹${currentMax.toLocaleString("en-IN")}`, sub: t("today's ceiling"), color: "text-emerald-600" },
            {
              label: t("Arrival Qty"),
              value: currentQty !== null ? currentQty.toLocaleString("en-IN") : "—",
              sub: t("quintals today"),
              color: "text-gray-700",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── 3. HISTORICAL PRICE TREND CHART ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">📈 {t("Historical Price Trend")}</h2>
            <span className="text-xs text-gray-400">{priceRows.length} {t("day" + (priceRows.length !== 1 ? "s" : ""))} {t("of data")}</span>
          </div>
          {priceRows.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-32 bg-gray-50 rounded-lg border border-dashed border-gray-200">
              <p className="text-sm text-gray-400">{t("Only 1 record available.")}</p>
              <p className="text-xs text-gray-300 mt-1">{t("Chart requires 2+ price records to render.")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                  width={70}
                />
                <Tooltip
                  formatter={(value: number) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    "Modal Price",
                  ]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#16a34a" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── 4 + 5. FORECAST + VOLATILITY ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Price Forecast */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">🔮 {t("Price Forecast")}</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Current Price")}</span>
                <span className="font-semibold text-gray-800">₹{currentPrice.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Predicted Next Price")}</span>
                <span className="font-bold text-lg text-green-700">₹{predictedPrice.toFixed(0)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Expected Change")}</span>
                <span className={`font-semibold text-sm ${expectedGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {expectedGain >= 0 ? "+" : ""}₹{expectedGain.toFixed(0)} ({expectedGain >= 0 ? "+" : ""}{expectedGainPct}%)
                </span>
              </div>
            </div>
            {prices.length < 5 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mt-4">
                ⚠ {t("Forecast improves with more data")} ({prices.length} {t("record" + (prices.length !== 1 ? "s" : ""))} {t("available")}).
              </p>
            )}
          </div>

          {/* Volatility / Risk */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">📊 {t("Market Risk Index")}</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Volatility Score")}</span>
                <span className="font-bold text-gray-800">{volatility.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Risk Level")}</span>
                <span className={`text-sm font-bold px-3 py-1 rounded-full border ${volStyle}`}>
                  {volatilityLabel} {t("Risk")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Avg Price")} ({priceRows.length}d)</span>
                <span className="font-semibold text-gray-700">₹{avg.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">{t("Price Direction")}</span>
                <span className={`font-bold ${trendColor}`}>{trendIcon} {trendLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 6. WEATHER IMPACT ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">🌤 {t("Weather Impact Analysis")}</h2>
          {weatherError || !weather ? (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-medium text-gray-600">{t("Weather data unavailable for")} {mandiName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t("Transport and supply disruption estimates cannot be calculated. Check /api/weather response shape.")}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{t("Temperature")}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {weatherTemp !== null ? `${weatherTemp}°C` : "N/A"}
                </p>
                {weatherTemp !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    {weatherTemp > 35
                      ? "🔥 High heat may accelerate spoilage"
                      : weatherTemp < 15
                      ? "❄ Cool — good for storage"
                      : "✅ Moderate conditions"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{t("Rain Probability")}</p>
                <p className="text-2xl font-bold text-gray-800">
                  {weatherRain !== null ? `${weatherRain}%` : "N/A"}
                </p>
                {weatherRain !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    {weatherRain > 60
                      ? "🌧 High rain may disrupt transport"
                      : weatherRain > 30
                      ? "🌦 Moderate rain risk"
                      : "☀ Low disruption risk"}
                  </p>
                )}
              </div>
              {weatherDesc && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{t("Condition")}</p>
                  <p className="text-sm font-semibold text-gray-700 capitalize mt-1">{weatherDesc}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 7. AI RECOMMENDATION ── */}
        <div className={`rounded-xl shadow-sm border p-6 ${recStyle.bg} ${recStyle.border}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800">🤖 {t("AI Market Recommendation")}</h2>
            {recommendationAction && !aiLoading && (
              <span className={`text-sm font-bold px-4 py-1.5 rounded-full ${recStyle.badge}`}>
                {recommendationAction}
              </span>
            )}
          </div>
          {aiLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">{t("Analyzing market conditions with AI...")}</span>
            </div>
          ) : (
            <p className={`text-sm leading-relaxed ${recStyle.text}`}>
              {recommendation || t("Analyzing market conditions...")}
            </p>
          )}
        </div>

        {/* ── 8. EXPECTED GAIN ESTIMATION ── */}
        {prices.length >= 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">💰 {t("Expected Gain Estimation")}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{t("Sell Today")}</p>
                <p className="text-xl font-bold text-gray-800">₹{currentPrice.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-400">{t("per quintal")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{t("Projected Price")}</p>
                <p className="text-xl font-bold text-green-700">₹{predictedPrice.toFixed(0)}</p>
                <p className="text-xs text-gray-400">{t("per quintal (forecast)")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{t("Difference")}</p>
                <p className={`text-xl font-bold ${expectedGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {expectedGain >= 0 ? "+" : "−"}₹{Math.abs(expectedGain).toFixed(0)}
                </p>
                <p className="text-xs text-gray-400">
                  {expectedGain >= 0 ? t("potential gain") : t("potential loss")} {t("vs now")}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-4 border-t pt-3">
              * {t("Forecast is based on linear regression of historical data. Market conditions may vary. Not financial advice.")}
            </p>
          </div>
        )}

        {/* ── FOOTER ── */}
        <p className="text-center text-xs text-gray-300 pb-4">
          {t("KisanSense · Powered by Agmarknet data · AI insights for informational use only")}
        </p>

      </div>
    </main>
  );
}
