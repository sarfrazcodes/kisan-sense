"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import { Sprout, TrendingUp, TrendingDown, ChevronRight, Star } from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface CommodityWithMeta {
  id: string;
  name: string;
  category: string;
  mandi_id: string | null;
  modal_price: number | null;
  trend: "up" | "down" | "flat" | null;
  isPopular: boolean;
}

interface UILabels {
  all: string;
  available: string;
  crops: string;
  noneFound: string;
  popular: string;
  rise: string;
  fall: string;
  stable: string;
  perQuintal: string;
  viewMarkets: string;
  selectCrops: string;
  subtitle: string;
}

const DEFAULT_LABELS: UILabels = {
  all: "All",
  available: "Available Markets",
  crops: "crops",
  noneFound: "No crops found.",
  popular: "Popular",
  rise: "Rise",
  fall: "Fall",
  stable: "Stable",
  perQuintal: "/ quintal",
  viewMarkets: "View Markets",
  selectCrops: "Select Crops",
  subtitle: "Choose a crop to view real-time market prices, AI forecasts, and nearby arbitrage opportunities.",
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const POPULAR_KEYWORDS = ["wheat", "rice", "onion", "cotton", "potato", "tomato"];

function isPopular(name: string): boolean {
  return POPULAR_KEYWORDS.some(k => name.toLowerCase().includes(k));
}

function getCategoryFromName(name: string): string {
  const lower = name.toLowerCase();
  if (["wheat", "rice", "maize", "paddy", "jowar", "bajra", "barley"].some(k => lower.includes(k))) return "Cereals";
  if (["onion", "potato", "tomato", "brinjal", "cauliflower", "cabbage", "carrot", "gourd", "amaranthus"].some(k => lower.includes(k))) return "Vegetables";
  if (["soybean", "mustard", "groundnut", "sunflower", "sesame", "linseed"].some(k => lower.includes(k))) return "Oilseeds";
  if (["cotton", "jute", "sugarcane", "tobacco"].some(k => lower.includes(k))) return "Cash Crops";
  if (["mango", "banana", "grape", "pomegranate", "apple", "orange", "guava"].some(k => lower.includes(k))) return "Fruits";
  return "Other";
}

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function CommoditiesPage() {
  const t = useT();

  const [commodities, setCommodities] = useState<CommodityWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // ── Translation maps for DB strings ──
  const [nameMap, setNameMap]         = useState<Map<string, string>>(new Map());
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map());
  const [translating, setTranslating] = useState(false);

  // ── Static UI labels — pre-translated ONCE in useEffect, never during render ──
  const [L, setL] = useState<UILabels>(DEFAULT_LABELS);

  // ── Step 1: Translate all static UI labels once on mount ──
  useEffect(() => {
    const translateLabels = async () => {
      try {
        const [
          all, available, crops, noneFound, popular,
          rise, fall, stable, perQuintal, viewMarkets,
          selectCrops, subtitle,
        ] = await Promise.all([
          t("All"),
          t("Available Markets"),
          t("crops"),
          t("No crops found."),
          t("Popular"),
          t("Rise"),
          t("Fall"),
          t("Stable"),
          t("/ quintal"),
          t("View Markets"),
          t("Select Crops"),
          t("Choose a crop to view real-time market prices, AI forecasts, and nearby arbitrage opportunities."),
        ]);
        setL({ all, available, crops, noneFound, popular, rise, fall, stable, perQuintal, viewMarkets, selectCrops, subtitle });
      } catch (err) {
        console.warn("⚠ Static label translation failed, using English:", err);
        // DEFAULT_LABELS already set as initial state — no action needed
      }
    };
    translateLabels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Step 2: Batch translate DB strings AFTER data fetch ──
  // Sequential loop (not Promise.all) to avoid hammering the translate API
  const batchTranslate = useCallback(async (items: CommodityWithMeta[]) => {
    if (items.length === 0) return;
    setTranslating(true);

    try {
      const uniqueNames      = [...new Set(items.map(c => c.name))];
      const uniqueCategories = [...new Set(items.map(c => c.category))];

      // Translate sequentially — one at a time to avoid "Failed to fetch" from concurrent calls
      const nMap = new Map<string, string>();
      for (const name of uniqueNames) {
        try {
          nMap.set(name, await t(name));
        } catch {
          nMap.set(name, name); // fallback to original
        }
      }

      const cMap = new Map<string, string>();
      for (const cat of uniqueCategories) {
        try {
          cMap.set(cat, await t(cat));
        } catch {
          cMap.set(cat, cat);
        }
      }

      setNameMap(nMap);
      setCategoryMap(cMap);
    } catch (err) {
      console.warn("⚠ Batch translation failed, showing originals:", err);
      setNameMap(new Map(items.map(c => [c.name, c.name])));
      setCategoryMap(new Map(items.map(c => [c.category, c.category])));
    } finally {
      setTranslating(false);
    }
  }, [t]);

  // ── Step 3: Fetch DB data ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: commData, error: commError } = await supabase
          .from("commodities")
          .select("id, name, category")
          .order("name", { ascending: true });

        if (commError) console.error("❌ Commodities error:", commError);
        if (!commData || commData.length === 0) { setLoading(false); return; }

        // Latest price per commodity
        const { data: priceData, error: priceError } = await supabase
          .from("price_history")
          .select("commodity_id, mandi_id, modal_price, date")
          .order("date", { ascending: false })
          .limit(commData.length * 3);

        if (priceError) console.error("❌ Price error:", priceError);

        const latestMap = new Map<string, { mandi_id: string; modal_price: number; date: string }>();
        if (priceData) {
          for (const row of priceData) {
            if (!latestMap.has(row.commodity_id)) {
              latestMap.set(row.commodity_id, {
                mandi_id: row.mandi_id,
                modal_price: Number(row.modal_price),
                date: row.date,
              });
            }
          }
        }

        // Previous prices for trend
        const dates = [...new Set([...latestMap.values()].map(v => v.date))].sort();
        const minDate = dates[0];
        const prevMap = new Map<string, number>();

        if (minDate) {
          const { data: prevData } = await supabase
            .from("price_history")
            .select("commodity_id, modal_price")
            .in("commodity_id", commData.map(c => c.id))
            .lt("date", minDate)
            .order("date", { ascending: false })
            .limit(commData.length * 2);

          if (prevData) {
            for (const p of prevData) {
              if (!prevMap.has(p.commodity_id)) prevMap.set(p.commodity_id, Number(p.modal_price));
            }
          }
        }

        const enriched: CommodityWithMeta[] = commData.map(c => {
          const latest = latestMap.get(c.id);
          const prev   = prevMap.get(c.id);
          let trend: "up" | "down" | "flat" | null = null;
          if (latest && prev && prev > 0) {
            const diff = ((latest.modal_price - prev) / prev) * 100;
            trend = diff > 1 ? "up" : diff < -1 ? "down" : "flat";
          }
          return {
            id: c.id,
            name: c.name,
            category: c.category ?? getCategoryFromName(c.name),
            mandi_id: latest?.mandi_id ?? null,
            modal_price: latest?.modal_price ?? null,
            trend,
            isPopular: isPopular(c.name),
          };
        });

        setCommodities(enriched);
        setLoading(false);

        // Translate DB strings after data is ready — never during render
        await batchTranslate(enriched);

      } catch (err) {
        console.error("❌ CommoditiesPage fetch failed:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, [batchTranslate]);

  // ── Helpers to read from translation maps with English fallback ──
  const tName = (name: string) => nameMap.get(name) ?? name;
  const tCat  = (cat: string)  => categoryMap.get(cat) ?? cat;

  // ── Category filter ──
  const categories = ["All", ...Array.from(new Set(commodities.map(c => c.category)))];
  const filtered   = activeCategory === "All"
    ? commodities
    : commodities.filter(c => c.category === activeCategory);

  // ─────────────────────────────────────────────
  // RENDER — zero t() calls anywhere below this line
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-green-50 font-sans">
      <div className="max-w-[95%] mx-auto space-y-10 p-6 md:p-10">

        {/* ── Header ── */}
        <div className="space-y-4 mt-6 mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900">
            {L.selectCrops}
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            {L.subtitle}
          </p>
        </div>

        {/* ── Category Filter Tabs ── */}
        {!loading && categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                  activeCategory === cat
                    ? "bg-green-700 text-white border-green-700 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-green-400 hover:text-green-700"
                }`}
              >
                {cat === "All" ? L.all : tCat(cat)}
              </button>
            ))}
          </div>
        )}

        {/* ── Grid ── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-800">{L.available}</h2>
            <span className="text-base font-bold text-green-800 bg-green-200 border border-green-300 px-4 py-1.5 rounded-full">
              {loading ? "..." : `${filtered.length} ${L.crops}`}
            </span>
          </div>

          {/* Loading skeletons */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-white border border-green-100 rounded-2xl p-6 h-52 animate-pulse">
                  <div className="w-16 h-16 bg-green-50 rounded-2xl mb-4" />
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-green-100">
              <p className="text-slate-500 text-lg">{L.noneFound}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filtered.map(crop => {
                const href = crop.mandi_id
                  ? `/dashboard/${crop.id}/${crop.mandi_id}`
                  : `/commodities/${crop.id}`;

                // Read from pre-built maps — zero t() / fetch calls here
                const displayName     = translating ? crop.name     : tName(crop.name);
                const displayCategory = translating ? crop.category : tCat(crop.category);

                return (
                  <Link
                    key={crop.id}
                    href={href}
                    className="group block bg-white border border-green-200 rounded-2xl p-6 hover:border-green-600 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden shadow-sm"
                  >
                    {/* Popular Badge */}
                    {crop.isPopular && (
                      <div className="absolute top-0 right-0 bg-yellow-100 px-4 py-1.5 rounded-bl-xl flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
                        <span className="text-[11px] font-extrabold text-yellow-800 uppercase tracking-wider">
                          {L.popular}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-5">
                      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors border border-green-100">
                        <Sprout className="w-8 h-8 text-green-700" />
                      </div>

                      {crop.trend === "up" && (
                        <div className="flex items-center text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                          <TrendingUp className="w-4 h-4 mr-1.5" /> {L.rise}
                        </div>
                      )}
                      {crop.trend === "down" && (
                        <div className="flex items-center text-sm font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                          <TrendingDown className="w-4 h-4 mr-1.5" /> {L.fall}
                        </div>
                      )}
                      {(crop.trend === "flat" || crop.trend === null) && (
                        <div className="flex items-center text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                          — {L.stable}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{displayName}</h3>
                      <p className="text-sm text-slate-500 font-medium">{displayCategory}</p>
                    </div>

                    {crop.modal_price !== null && (
                      <div className="mt-3">
                        <span className="text-lg font-extrabold text-green-700">
                          ₹{crop.modal_price.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">{L.perQuintal}</span>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-green-700 group-hover:text-green-800">
                      {L.viewMarkets}
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
