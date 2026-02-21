"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Calculator, TrendingUp, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import { linearRegressionForecast } from "@/lib/intelligence/forecastEngine";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface PredictionData {
  currentPrice: number;
  predictedPrice: number;
  expectedGainPerQuintal: number;
  confidence: number;
}

interface UILabels {
  back: string;
  profitCalculator: string;
  subtitle: string;
  harvestQty: string;
  harvestQtyDesc: string;
  quintals: string;
  aiContext: string;
  aiContextDesc: string;
  aiActionPlan: string;
  sellToday: string;
  baseValue: string;
  holdFor: string;
  predicted: string;
  target: string;
  additionalProfit: string;
  waitingDesc: string;
  loading: string;
  noData: string;
  days: string;
  perQtl: string;
  confidence: string;
}

const DEFAULT_LABELS: UILabels = {
  back: "← Back to Dashboard",
  profitCalculator: "Profit Calculator",
  subtitle: "Enter your total harvest quantity below. See exactly how much extra money you can make by following our AI holding predictions.",
  harvestQty: "Your Harvest Quantity",
  harvestQtyDesc: "How many quintals do you have ready to sell?",
  quintals: "Quintals",
  aiContext: "AI Market Context",
  aiContextDesc: "Our model predicts prices will rise by",
  aiActionPlan: "Your AI Action Plan",
  sellToday: "If you sell today at",
  baseValue: "Base Value",
  holdFor: "If you HOLD for",
  predicted: "Predicted",
  target: "Target",
  additionalProfit: "Additional Profit",
  waitingDesc: "By waiting, you generate this extra income without planting a single extra seed.",
  loading: "Loading market data...",
  noData: "No price data available for this selection.",
  days: "days",
  perQtl: "per quintal",
  confidence: "Confidence",
};

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function ImpactCalculatorPage() {
  const t = useT();
  const searchParams = useSearchParams();

  const commodityId = searchParams?.get("commodity") ?? "";
  const mandiId = searchParams?.get("mandi") ?? "";

  const [quantity, setQuantity] = useState<number>(50);
  const [commodityName, setCommodityName] = useState("");
  const [commodityNameT, setCommodityNameT] = useState("");
  const [mandiName, setMandiName] = useState("");
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [L, setL] = useState<UILabels>(DEFAULT_LABELS);

  // ── Translate static labels once ──
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

  // ── Fetch real data from Supabase ──
  useEffect(() => {
    if (!commodityId || !mandiId) return;

    const fetchData = async () => {
      // Commodity name
      const { data: commodity } = await supabase
        .from("commodities").select("name").eq("id", commodityId).single();
      if (commodity) {
        setCommodityName(commodity.name);
        try { setCommodityNameT(await t(commodity.name)); } catch { setCommodityNameT(commodity.name); }
      }

      // Mandi name
      const { data: mandi } = await supabase
        .from("mandis").select("name").eq("id", mandiId).single();
      if (mandi) {
        try {
          const translated = await t(mandi.name);
          setMandiName(translated);
        } catch { setMandiName(mandi.name); }
      }

      // Price history
      const { data: priceData } = await supabase
        .from("price_history")
        .select("modal_price, date")
        .eq("commodity_id", commodityId)
        .eq("mandi_id", mandiId)
        .order("date", { ascending: true })
        .limit(30);

      if (priceData && priceData.length > 0) {
        const prices = priceData.map(r => Number(r.modal_price));
        const currentPrice = prices[prices.length - 1];
        const predictedPrice = prices.length > 1
          ? linearRegressionForecast(prices)
          : currentPrice;
        const expectedGainPerQuintal = predictedPrice - currentPrice;
        const confidence = Math.min(95, 40 + prices.length * 2);

        setPrediction({
          currentPrice,
          predictedPrice: Math.round(predictedPrice),
          expectedGainPerQuintal: Math.round(expectedGainPerQuintal),
          confidence,
        });
      }

      setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commodityId, mandiId]);

  // ── Live calculations ──
  const currentTotalValue  = prediction ? quantity * prediction.currentPrice : 0;
  const futureTotalValue   = prediction ? quantity * prediction.predictedPrice : 0;
  const additionalIncome   = prediction ? quantity * prediction.expectedGainPerQuintal : 0;
  const isGain             = additionalIncome >= 0;

  // ─────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">{L.loading}</p>
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="min-h-screen bg-green-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-semibold">{L.noData}</p>
          <Link href={`/dashboard/${commodityId}/${mandiId}`}
            className="mt-4 inline-block text-green-700 font-bold hover:underline">
            {L.back}
          </Link>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-green-100 font-sans pb-16 pt-8">
      <div className="max-w-[95%] mx-auto space-y-10 p-6 md:p-10">

        {/* ── Header ── */}
        <div className="space-y-4 mb-4">
          <Link
            href={`/dashboard/${commodityId}/${mandiId}`}
            className="text-green-700 font-bold flex items-center gap-1 hover:underline w-fit"
          >
            {L.back}
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 flex items-center gap-4">
            <Calculator className="w-10 h-10 text-green-700 shrink-0" />
            <span className="line-clamp-2">{commodityNameT || commodityName} {L.profitCalculator}</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl">{L.subtitle}</p>
          {mandiName && (
            <p className="text-sm text-slate-400 font-medium">📍 {mandiName}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── LEFT: Input ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-green-200 rounded-3xl p-8 shadow-sm">
              <label className="block text-lg font-extrabold text-slate-900 mb-2">
                {L.harvestQty}
              </label>
              <p className="text-sm text-slate-500 mb-6">
                {L.harvestQtyDesc}
              </p>

              {/* Number Input */}
              <div className="relative mb-8">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="block w-full text-4xl font-extrabold text-green-900 bg-green-50 border-2 border-green-200 rounded-2xl py-6 pl-6 pr-28 focus:ring-0 focus:border-green-600 transition-colors outline-none"
                />
                <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-400">{L.quintals}</span>
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-4">
                <input
                  type="range"
                  min="1"
                  max="500"
                  value={Math.min(quantity, 500)}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>1 Qtl</span>
                  <span>250 Qtl</span>
                  <span>500+ Qtl</span>
                </div>
              </div>

              {/* Quick select buttons */}
              <div className="flex gap-2 mt-6 flex-wrap">
                {[10, 25, 50, 100, 200].map(q => (
                  <button
                    key={q}
                    onClick={() => setQuantity(q)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold border transition-all ${
                      quantity === q
                        ? "bg-green-700 text-white border-green-700"
                        : "bg-white text-slate-600 border-slate-200 hover:border-green-400"
                    }`}
                  >
                    {q} Qtl
                  </button>
                ))}
              </div>
            </div>

            {/* AI Context Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-4">
              <Info className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-blue-900 mb-1">{L.aiContext}</h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {L.aiContextDesc}{" "}
                  <strong>
                    {isGain ? "+" : ""}₹{Math.abs(prediction.expectedGainPerQuintal)} {L.perQtl}
                  </strong>{" "}
                  based on {prediction.confidence}% AI {L.confidence}.
                </p>

                {/* Mini stats */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-slate-400 font-semibold uppercase">Current</p>
                    <p className="text-lg font-extrabold text-slate-800">₹{prediction.currentPrice.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-slate-400">{L.perQtl}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-slate-400 font-semibold uppercase">{L.predicted}</p>
                    <p className={`text-lg font-extrabold ${isGain ? "text-green-700" : "text-red-600"}`}>
                      ₹{prediction.predictedPrice.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-slate-400">{L.perQtl}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Financial Impact ── */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden flex-grow flex flex-col justify-center">

              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-500/20 rounded-full blur-3xl pointer-events-none" />

              <h2 className="text-slate-400 font-extrabold tracking-widest uppercase mb-8 text-sm md:text-base">
                {L.aiActionPlan}
              </h2>

              <div className="space-y-6 relative z-10">

                {/* Scenario 1: Sell Today */}
                <div className="flex justify-between items-end border-b border-slate-700 pb-6">
                  <div>
                    <p className="text-slate-400 font-medium mb-1 text-sm">
                      {L.sellToday} ₹{prediction.currentPrice.toLocaleString("en-IN")}/qtl × {quantity} qtl
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-white">
                      ₹{currentTotalValue.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-slate-500 font-medium text-sm shrink-0">{L.baseValue}</div>
                </div>

                {/* Scenario 2: Hold */}
                <div className="flex justify-between items-end pb-4">
                  <div>
                    <p className={`font-medium mb-1 text-sm ${isGain ? "text-green-400" : "text-red-400"}`}>
                      {L.holdFor} ({L.predicted}: ₹{prediction.predictedPrice.toLocaleString("en-IN")}/qtl)
                    </p>
                    <p className="text-3xl md:text-4xl font-extrabold text-white">
                      ₹{futureTotalValue.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold border shrink-0 ${
                    isGain
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}>
                    {L.target}
                  </div>
                </div>
              </div>

              {/* Big Output Box */}
              <div className={`mt-8 rounded-2xl p-6 md:p-8 shadow-inner border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
                isGain
                  ? "bg-gradient-to-br from-green-500 to-green-700 border-green-400"
                  : "bg-gradient-to-br from-red-500 to-red-700 border-red-400"
              }`}>
                <div>
                  <p className="text-green-100 font-extrabold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> {L.additionalProfit}
                  </p>
                  <p className="text-4xl md:text-5xl font-black text-white">
                    {isGain ? "+" : "−"}₹{Math.abs(additionalIncome).toLocaleString("en-IN")}
                  </p>
                  <p className="text-green-100 text-sm mt-1 font-medium">
                    = {quantity} qtl × {isGain ? "+" : ""}₹{prediction.expectedGainPerQuintal}/qtl
                  </p>
                </div>

                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/20 text-white max-w-[200px]">
                  <p className="text-xs font-bold leading-relaxed">
                    {L.waitingDesc}
                  </p>
                  <p className="text-xs text-white/70 mt-2">
                    AI {L.confidence}: {prediction.confidence}%
                  </p>
                </div>
              </div>

              {/* Per-quintal breakdown */}
              <div className="mt-6 grid grid-cols-3 gap-3 relative z-10">
                {[
                  { label: "Per Quintal Gain", value: `${isGain ? "+" : ""}₹${prediction.expectedGainPerQuintal}`, color: isGain ? "text-green-400" : "text-red-400" },
                  { label: "Your Quantity", value: `${quantity} Qtl`, color: "text-white" },
                  { label: "AI Confidence", value: `${prediction.confidence}%`, color: "text-yellow-400" },
                ].map(item => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                    <p className="text-slate-400 text-xs font-semibold uppercase mb-1">{item.label}</p>
                    <p className={`text-lg font-extrabold ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
