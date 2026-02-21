"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import { linearRegressionForecast } from "@/lib/intelligence/forecastEngine";
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, ShieldAlert, CheckCircle2,
  AlertTriangle, MapPin, ArrowUpRight, ArrowDownRight,
  CloudOff, Thermometer, Droplets, Wind,
} from "lucide-react";

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
  temp?: number;
  temperature?: number;
  rainProbability?: number;
  rain_probability?: number;
  precipitation?: number;
  description?: string;
  condition?: string;
}

interface UILabels {
  loading: string;
  noData: string;
  noDataDesc: string;
  intelligence: string;
  lastUpdated: string;
  trend: string;
  rising: string;
  falling: string;
  stable: string;
  todayPrice: string;
  perQuintal: string;
  recommendation: string;
  expectedGain: string;
  marketRisk: string;
  aiConfidence: string;
  priceForecastModel: string;
  history: string;
  forecast: string;
  band: string;
  modalPrice: string;
  minPrice: string;
  maxPrice: string;
  arrivalQty: string;
  todaysFloor: string;
  todaysCeiling: string;
  quintalsToday: string;
  historicalTrend: string;
  daysOfData: string;
  onlyOneRecord: string;
  chartNeeds: string;
  priceForecast: string;
  currentPrice: string;
  predictedNext: string;
  expectedChange: string;
  forecastWarning: string;
  records: string;
  available: string;
  riskIndex: string;
  volatilityScore: string;
  riskLevel: string;
  avgPrice: string;
  priceDirection: string;
  risk: string;
  weatherImpact: string;
  temperature: string;
  rainProb: string;
  condition: string;
  weatherUnavailable: string;
  weatherUnavailableDesc: string;
  highHeat: string;
  coolTemp: string;
  moderateTemp: string;
  highRain: string;
  moderateRain: string;
  lowRain: string;
  aiRecommendation: string;
  aiAnalyzing: string;
  gainEstimation: string;
  sellToday: string;
  projectedPrice: string;
  difference: string;
  perQuintalForecast: string;
  potentialGain: string;
  potentialLoss: string;
  vsNow: string;
  disclaimer: string;
  footer: string;
  low: string;
  moderate: string;
  high: string;
  mandi: string;
}

const DEFAULT_LABELS: UILabels = {
  loading: "Loading market intelligence...",
  noData: "No Price Data Available",
  noDataDesc: "No price history found for",
  intelligence: "Market Intelligence",
  lastUpdated: "Last updated",
  trend: "Trend",
  rising: "Rising",
  falling: "Falling",
  stable: "Stable",
  todayPrice: "Today's Price",
  perQuintal: "per quintal",
  recommendation: "Recommendation",
  expectedGain: "Expected Gain (3-Day)",
  marketRisk: "Market Risk",
  aiConfidence: "AI Confidence",
  priceForecastModel: "Price Forecast Model",
  history: "History",
  forecast: "Forecast",
  band: "Band",
  modalPrice: "Modal Price",
  minPrice: "Min Price",
  maxPrice: "Max Price",
  arrivalQty: "Arrival Qty",
  todaysFloor: "today's floor",
  todaysCeiling: "today's ceiling",
  quintalsToday: "quintals today",
  historicalTrend: "Historical Price Trend",
  daysOfData: "days of data",
  onlyOneRecord: "Only 1 record available.",
  chartNeeds: "Chart requires 2+ price records to render.",
  priceForecast: "Price Forecast",
  currentPrice: "Current Price",
  predictedNext: "Predicted Next Price",
  expectedChange: "Expected Change",
  forecastWarning: "Forecast improves with more data",
  records: "records",
  available: "available",
  riskIndex: "Market Risk Index",
  volatilityScore: "Volatility Score",
  riskLevel: "Risk Level",
  avgPrice: "Avg Price",
  priceDirection: "Price Direction",
  risk: "Risk",
  weatherImpact: "Weather Impact Analysis",
  temperature: "Temperature",
  rainProb: "Rain Probability",
  condition: "Condition",
  weatherUnavailable: "Local Weather Data Unavailable",
  weatherUnavailableDesc: "Weather data couldn't be retrieved for this mandi location. This is common for smaller towns and rural markets. Your price intelligence and AI recommendations are still fully accurate — weather is just one of many factors we analyze.",
  highHeat: "🔥 High heat may accelerate spoilage",
  coolTemp: "❄ Cool — good for storage",
  moderateTemp: "✅ Moderate conditions",
  highRain: "🌧 High rain may disrupt transport",
  moderateRain: "🌦 Moderate rain risk",
  lowRain: "☀ Low disruption risk",
  aiRecommendation: "AI Market Recommendation",
  aiAnalyzing: "Analyzing market conditions with AI...",
  gainEstimation: "Expected Gain Estimation",
  sellToday: "Sell Today",
  projectedPrice: "Projected Price",
  difference: "Difference",
  perQuintalForecast: "per quintal (forecast)",
  potentialGain: "potential gain",
  potentialLoss: "potential loss",
  vsNow: "vs now",
  disclaimer: "Forecast is based on linear regression of historical data. Market conditions may vary. Not financial advice.",
  footer: "KisanSense · Powered by Agmarknet data · AI insights for informational use only",
  low: "Low",
  moderate: "Moderate",
  high: "High",
  mandi: "Mandi",
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getTrend(prices: number[]): "up" | "down" | "flat" {
  if (prices.length < 2) return "flat";
  const recent = prices.slice(-5);
  const diff = ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100;
  if (diff > 1.5) return "up";
  if (diff < -1.5) return "down";
  return "flat";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch { return dateStr; }
}

function getWeatherTemp(w: WeatherData): number | null {
  return w.temp ?? w.temperature ?? null;
}
function getWeatherRain(w: WeatherData): number | null {
  return w.rainProbability ?? w.rain_probability ?? w.precipitation ?? null;
}

function getVolatilityStyle(label: string) {
  if (label === "High") return { bar: "bg-red-500", text: "text-red-600 bg-red-50 border-red-200", width: "85%" };
  if (label === "Moderate") return { bar: "bg-yellow-500", text: "text-yellow-700 bg-yellow-50 border-yellow-200", width: "50%" };
  return { bar: "bg-green-500", text: "text-green-700 bg-green-50 border-green-200", width: "20%" };
}

function getRecStyle(action: string) {
  const u = action.toUpperCase();
  if (u.includes("SELL")) return {
    bg: "bg-emerald-50", border: "border-emerald-200",
    badge: "bg-emerald-600 text-white", text: "text-emerald-800",
    icon: <CheckCircle2 className="w-4 h-4 mr-2" />, barColor: "bg-emerald-500",
  };
  if (u.includes("WAIT")) return {
    bg: "bg-orange-50", border: "border-orange-200",
    badge: "bg-orange-500 text-white", text: "text-orange-800",
    icon: <AlertTriangle className="w-4 h-4 mr-2" />, barColor: "bg-orange-500",
  };
  return {
    bg: "bg-blue-50", border: "border-blue-200",
    badge: "bg-blue-600 text-white", text: "text-blue-800",
    icon: <ShieldAlert className="w-4 h-4 mr-2" />, barColor: "bg-blue-500",
  };
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function DashboardPage() {
  const t = useT();
  const params = useParams();

  const commodityId = params.commodity as string;
  const mandiId = params.mandi as string;

  const [commodityName, setCommodityName] = useState("");
  const [commodityNameT, setCommodityNameT] = useState("");
  const [mandiName, setMandiName] = useState("");
  const [mandiNameT, setMandiNameT] = useState("");
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [prices, setPrices] = useState<number[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [recommendationAction, setRecommendationAction] = useState("");
  const [recommendationT, setRecommendationT] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [L, setL] = useState<UILabels>(DEFAULT_LABELS);

  // ── Step 1: Pre-translate all static labels ──
  useEffect(() => {
    const translateLabels = async () => {
      try {
        const keys = Object.keys(DEFAULT_LABELS) as (keyof UILabels)[];
        const values = await Promise.all(keys.map(k => t(DEFAULT_LABELS[k])));
        const translated = {} as UILabels;
        keys.forEach((k, i) => { translated[k] = values[i]; });
        setL(translated);
      } catch {
        // keep defaults
      }
    };
    translateLabels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: Fetch core data ──
  useEffect(() => {
    if (!commodityId || commodityId === "undefined" || !mandiId || mandiId === "undefined") {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      // Commodity name
      const { data: commodity } = await supabase
        .from("commodities").select("name").eq("id", commodityId).single();
      if (commodity) {
        setCommodityName(commodity.name);
        try { setCommodityNameT(await t(commodity.name)); } catch { setCommodityNameT(commodity.name); }
      }

      // Mandi name + weather
      const { data: mandi } = await supabase
        .from("mandis").select("name").eq("id", mandiId).single();
      if (mandi) {
        setMandiName(mandi.name);
        try { setMandiNameT(await t(mandi.name)); } catch { setMandiNameT(mandi.name); }

        // Weather — clean city name
        try {
          const cleanCity = mandi.name
            .replace(/\(.*?\)/g, "").replace(/\bAPMC\b/gi, "")
            .replace(/\bMandi\b/gi, "").replace(/\bMarket\b/gi, "")
            .replace(/\bF&V\b/gi, "").replace(/\bVeg\.?\b/gi, "")
            .replace(/\bSandhai\b/gi, "").replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ").trim();
          const res = await fetch(`/api/weather?location=${encodeURIComponent(cleanCity)}`);
          const weatherData = await res.json();
          if (!res.ok || weatherData.error) throw new Error("Weather unavailable");
          setWeather(weatherData);
        } catch {
          setWeatherError(true);
        }
      }

      // Price history
      const { data: priceData } = await supabase
        .from("price_history")
        .select("modal_price, min_price, max_price, arrival_quantity, date")
        .eq("commodity_id", commodityId)
        .eq("mandi_id", mandiId)
        .order("date", { ascending: true })
        .limit(30);

      if (priceData && priceData.length > 0) {
        const rows: PriceRow[] = priceData.map(row => ({
          modal_price: Number(row.modal_price),
          min_price: Number(row.min_price),
          max_price: Number(row.max_price),
          arrival_quantity: row.arrival_quantity != null ? Number(row.arrival_quantity) : null,
          date: row.date,
        }));
        setPriceRows(rows);
        setPrices(rows.map(r => r.modal_price));
        setLastUpdated(rows[rows.length - 1].date);
      }

      setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commodityId, mandiId]);

  // ── Step 3: AI recommendation (non-blocking) ──
  useEffect(() => {
    if (!commodityName || prices.length === 0) return;

    const fetchRecommendation = async () => {
      setAiLoading(true);
      try {
        const res = await fetch("/api/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prices,
            weather,
            commodity: commodityName,
            mandi: mandiName,
            // Prompt hint for Gemini to return detailed insight
            promptHint: `You are an expert agricultural market analyst in India. Analyze the price trend for ${commodityName} at ${mandiName} mandi. Prices over last ${prices.length} days: ${prices.join(", ")} (₹/quintal). ${weather ? `Current weather: ${weather.description || weather.condition || "N/A"}, Temp: ${weather.temp || weather.temperature || "N/A"}°C, Rain probability: ${weather.rainProbability || weather.rain_probability || "N/A"}%.` : "Weather data unavailable."} Provide a detailed 3-4 sentence analysis covering: (1) current price trend direction and momentum, (2) weather impact on supply/demand, (3) a specific BUY/SELL/HOLD/WAIT recommendation with reasoning, (4) estimated price movement in next 3-5 days. Be specific with numbers and percentages.`,
          }),
        });

        if (!res.ok) throw new Error(`AI API ${res.status}`);
        const data = await res.json();

        const fullText: string =
          data.recommendation || data.insight || data.message || data.text ||
          data.result || data.output || data.response || data.content ||
          data?.data?.recommendation || data?.data?.insight ||
          data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        const upper = fullText.toUpperCase();
        if (upper.includes("SELL NOW") || upper.includes("SELL")) setRecommendationAction("SELL NOW");
        else if (upper.includes("WAIT")) setRecommendationAction("WAIT");
        else if (upper.includes("HOLD")) setRecommendationAction("HOLD");
        else if (fullText) setRecommendationAction("MONITOR");

        const insightText = fullText ||
          "Market conditions are stable. Monitor price movement over the next 2–3 days before making a selling decision.";

        setRecommendation(insightText);

        // Translate recommendation text
        try { setRecommendationT(await t(insightText)); } catch { setRecommendationT(insightText); }

      } catch {
        // Rule-based fallback with detailed text
        const trend = getTrend(prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const latest = prices[prices.length - 1];
        const changeFromAvg = (((latest - avg) / avg) * 100).toFixed(1);

        let action = "HOLD";
        let insight = "";

        if (trend === "up") {
          action = "SELL NOW";
          insight = `${commodityName} prices at ${mandiName} are showing a strong upward trend, currently ₹${latest.toLocaleString("en-IN")}/quintal — ${changeFromAvg}% above the ${prices.length}-day average of ₹${avg.toFixed(0)}. Momentum is positive with consistent buying pressure. We recommend selling at current rates to capture this peak. If you can wait 2-3 days, prices may rise further, but the risk of reversal also increases.`;
        } else if (trend === "down") {
          action = "WAIT";
          insight = `${commodityName} prices at ${mandiName} are under downward pressure, currently at ₹${latest.toLocaleString("en-IN")}/quintal — ${Math.abs(Number(changeFromAvg))}% below the ${prices.length}-day average of ₹${avg.toFixed(0)}. This decline may be driven by increased arrivals or seasonal demand shifts. We recommend holding stock for 3-5 days to wait for price stabilization. Monitor daily arrivals — if volumes drop, prices typically recover within a week.`;
        } else {
          action = "HOLD";
          insight = `${commodityName} prices at ${mandiName} are stable at ₹${latest.toLocaleString("en-IN")}/quintal, close to the ${prices.length}-day average of ₹${avg.toFixed(0)}. There is no strong signal for an immediate price move in either direction. Hold your stock and monitor for the next 2-3 days. A breakout above ₹${(latest * 1.03).toFixed(0)} would signal a good selling opportunity.`;
        }

        setRecommendationAction(action);
        setRecommendation(insight);
        try { setRecommendationT(await t(insight)); } catch { setRecommendationT(insight); }
      } finally {
        setAiLoading(false);
      }
    };

    fetchRecommendation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, weather, commodityName, mandiName]);

  // ─────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
          <p className="text-slate-500 font-semibold text-lg">{L.loading}</p>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────
  // NO DATA
  // ─────────────────────────────────────────────
  if (prices.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="max-w-lg w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">{L.noData}</h1>
          <p className="text-slate-500 text-sm">{L.noDataDesc} <strong>{commodityNameT || commodityName}</strong></p>
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
  const expectedGainPct = ((expectedGain / currentPrice) * 100).toFixed(1);

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / prices.length;
  const volatility = Math.sqrt(variance);
  const volatilityLabel = volatility > 150 ? "High" : volatility > 50 ? "Moderate" : "Low";
  const volatilityLabelT = volatility > 150 ? L.high : volatility > 50 ? L.moderate : L.low;

  const trend = getTrend(prices);
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-500";
  const trendLabelT = trend === "up" ? L.rising : trend === "down" ? L.falling : L.stable;
  const trendBg = trend === "up" ? "bg-emerald-50 text-emerald-700" : trend === "down" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600";

  // Chart data — historical + forecast point
  const chartData = [
    ...priceRows.map(row => ({ date: formatDate(row.date), price: row.modal_price, forecast: undefined })),
    ...(prices.length > 1 ? [{ date: "→ Forecast", price: undefined, forecast: Math.round(predictedPrice) }] : []),
  ];

  const weatherTemp = weather ? getWeatherTemp(weather) : null;
  const weatherRain = weather ? getWeatherRain(weather) : null;
  const weatherDesc = weather?.description || weather?.condition || null;

  const recStyle = getRecStyle(recommendationAction);
  const volStyle = getVolatilityStyle(volatilityLabel);

  // Confidence score — based on data points available (more data = higher confidence)
  const confidence = Math.min(95, 40 + prices.length * 2);

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .dash-font { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6 dash-font">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                KisanSense {L.intelligence}
              </span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${trendBg}`}>
                {trendIcon} {trendLabelT}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">
              {commodityNameT || commodityName}
            </h1>
            <p className="text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
              <MapPin className="w-4 h-4 text-green-600" />
              {mandiNameT || mandiName} {L.mandi}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Impact Calculator Button */}
            <a
              href={`/impact/commodity?commodity=${commodityId}&mandi=${mandiId}`}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md"
            >
              <span className="text-base">💰</span>
              Impact Calculator
            </a>

            {lastUpdated && (
              <div className="text-right">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{L.lastUpdated}</p>
                <p className="text-slate-700 font-bold text-lg">{formatDate(lastUpdated)}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TOP STAT CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Today's Price */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 md:col-span-1">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">{L.todayPrice}</p>
            <div className="flex items-end gap-2">
              <h2 className="text-2xl font-extrabold text-slate-900">₹{currentPrice.toLocaleString("en-IN")}</h2>
              <span className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-full mb-0.5 ${expectedGain >= 0 ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                {expectedGain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(Number(expectedGainPct))}%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{L.perQuintal}</p>
          </div>

          {/* Recommendation */}
          <div className={`p-5 rounded-2xl shadow-sm border ${recStyle.bg} ${recStyle.border}`}>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">{L.recommendation}</p>
            {aiLoading ? (
              <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className={`inline-flex items-center px-3 py-1.5 rounded-xl font-bold text-sm ${recStyle.badge}`}>
                {recStyle.icon} {recommendationAction || "..."}
              </div>
            )}
            <p className="text-xs text-slate-500 mt-2 font-medium">
              {trend === "up" ? "Prices rising" : trend === "down" ? "Prices falling" : "Prices stable"}
            </p>
          </div>

          {/* Expected Gain */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">{L.expectedGain}</p>
            <h2 className={`text-2xl font-extrabold ${expectedGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {expectedGain >= 0 ? "+" : ""}₹{Math.abs(expectedGain).toFixed(0)}
            </h2>
            <p className="text-xs text-slate-400 mt-1">{L.perQuintal}</p>
          </div>

          {/* Market Risk */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">{L.marketRisk}</p>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className={`w-5 h-5 ${volatility > 150 ? "text-red-500" : volatility > 50 ? "text-yellow-500" : "text-green-600"}`} />
              <span className="font-bold text-slate-800">{volatilityLabelT}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div className={`${volStyle.bar} h-1.5 rounded-full transition-all`} style={{ width: volStyle.width }} />
            </div>
          </div>

          {/* AI Confidence */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">{L.aiConfidence}</p>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h2 className="text-2xl font-extrabold text-slate-900">{confidence}%</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">{prices.length}-day data</p>
          </div>
        </div>

        {/* ── CHART + SIDE PANEL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-700" />
                {L.priceForecastModel}
              </h3>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-700 rounded-full inline-block" /> {L.history}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-dashed border-yellow-500 rounded-full inline-block" /> {L.forecast}</span>
              </div>
            </div>
            <div className="w-full" style={{ height: 280 }}>
              {priceRows.length < 2 ? (
                <div className="flex flex-col items-center justify-center h-full bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-400">{L.onlyOneRecord}</p>
                  <p className="text-xs text-slate-300 mt-1">{L.chartNeeds}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }} dy={8} />
                    <YAxis axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                      tickFormatter={v => `₹${v}`} width={65} />
                    <Tooltip
                      formatter={(value: number) => [`₹${value?.toLocaleString("en-IN")}`, ""]}
                      contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 600 }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#15803d" strokeWidth={2.5}
                      dot={{ r: 3.5, fill: "#15803d", strokeWidth: 0 }}
                      activeDot={{ r: 5 }} connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" stroke="#eab308" strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 5, fill: "#eab308", strokeWidth: 0 }}
                      connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-5">

            {/* AI Recommendation Detail */}
            <div className={`p-5 rounded-2xl border ${recStyle.bg} ${recStyle.border}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-800 text-sm">🤖 {L.aiRecommendation}</h4>
                {recommendationAction && !aiLoading && (
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${recStyle.badge}`}>
                    {recommendationAction}
                  </span>
                )}
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-500">{L.aiAnalyzing}</span>
                </div>
              ) : (
                <p className={`text-sm leading-relaxed ${recStyle.text}`}>
                  {recommendationT || recommendation}
                </p>
              )}
            </div>

            {/* Price Breakdown */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm mb-4">📊 Price Breakdown</h4>
              <div className="space-y-3">
                {[
                  { label: L.modalPrice, value: `₹${currentPrice.toLocaleString("en-IN")}`, color: "text-slate-900" },
                  { label: L.minPrice, value: `₹${currentMin.toLocaleString("en-IN")}`, color: "text-blue-600" },
                  { label: L.maxPrice, value: `₹${currentMax.toLocaleString("en-IN")}`, color: "text-emerald-600" },
                  { label: L.arrivalQty, value: currentQty !== null ? `${currentQty.toLocaleString("en-IN")} q` : "—", color: "text-slate-600" },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-semibold">{item.label}</span>
                    <span className={`font-bold text-sm ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Index */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h4 className="font-bold text-slate-800 text-sm mb-4">⚡ {L.riskIndex}</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">{L.volatilityScore}</span>
                  <span className="font-bold text-sm text-slate-800">{volatility.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">{L.riskLevel}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${volStyle.text}`}>
                    {volatilityLabelT} {L.risk}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">{L.avgPrice}</span>
                  <span className="font-bold text-sm text-slate-700">₹{avg.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-semibold">{L.priceDirection}</span>
                  <span className={`font-bold text-sm ${trendColor}`}>{trendIcon} {trendLabelT}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── WEATHER + GAIN ESTIMATION ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Weather */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">🌤 {L.weatherImpact}</h3>

            {weatherError || !weather ? (
              <div className="flex gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="w-10 h-10 shrink-0 bg-blue-100 rounded-xl flex items-center justify-center">
                  <CloudOff className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-800 mb-1">{L.weatherUnavailable}</p>
                  <p className="text-xs text-blue-600 leading-relaxed">{L.weatherUnavailableDesc}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <Thermometer className="w-5 h-5 text-orange-500 mb-2" />
                  <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{L.temperature}</p>
                  <p className="text-xl font-extrabold text-slate-900">
                    {weatherTemp !== null ? `${weatherTemp}°C` : "N/A"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {weatherTemp !== null
                      ? weatherTemp > 35 ? L.highHeat : weatherTemp < 15 ? L.coolTemp : L.moderateTemp
                      : ""}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <Droplets className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{L.rainProb}</p>
                  <p className="text-xl font-extrabold text-slate-900">
                    {weatherRain !== null ? `${weatherRain}%` : "N/A"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {weatherRain !== null
                      ? weatherRain > 60 ? L.highRain : weatherRain > 30 ? L.moderateRain : L.lowRain
                      : ""}
                  </p>
                </div>
                {weatherDesc && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <Wind className="w-5 h-5 text-slate-400 mb-2" />
                    <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{L.condition}</p>
                    <p className="text-sm font-bold text-slate-700 capitalize mt-1">{weatherDesc}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expected Gain */}
          {prices.length >= 2 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-4">💰 {L.gainEstimation}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{L.sellToday}</p>
                  <p className="text-xl font-extrabold text-slate-800">₹{currentPrice.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-slate-400 mt-1">{L.perQuintal}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                  <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{L.projectedPrice}</p>
                  <p className="text-xl font-extrabold text-green-700">₹{predictedPrice.toFixed(0)}</p>
                  <p className="text-xs text-slate-400 mt-1">{L.perQuintalForecast}</p>
                </div>
                <div className={`rounded-xl p-4 border ${expectedGain >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                  <p className="text-xs text-slate-400 font-semibold uppercase mb-1">{L.difference}</p>
                  <p className={`text-xl font-extrabold ${expectedGain >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {expectedGain >= 0 ? "+" : "−"}₹{Math.abs(expectedGain).toFixed(0)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {expectedGain >= 0 ? L.potentialGain : L.potentialLoss}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-4 border-t pt-3">* {L.disclaimer}</p>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <p className="text-center text-xs text-slate-300 pt-2">{L.footer}</p>

      </div>
    </div>
  );
}
