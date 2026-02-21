"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import Link from "next/link";
import { MapPin, TrendingUp, TrendingDown, ChevronRight, Search, Navigation, Award } from "lucide-react";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface MandiResult {
  mandi: {
    id: string;
    name: string;
    state?: string;
  };
  price: number | null;
  trend: "up" | "down" | "flat";
  isBest?: boolean;
}

interface UILabels {
  marketsFor: string;
  loading: string;
  noMarkets: string;
  back: string;
  selectMarket: string;
  foundMandis: string;
  activeMandis: string;
  searchPlaceholder: string;
  noMarketsFound: string;
  noMarketsFoundDesc: string;
  todayPrice: string;
  bestPrice: string;
  active: string;
}

const DEFAULT_LABELS: UILabels = {
  marketsFor: "Markets for",
  loading: "Loading markets...",
  noMarkets: "No markets available for this commodity.",
  back: "← Back to Crops",
  selectMarket: "Select Market",
  foundMandis: "active mandis for your selection.",
  activeMandis: "active mandis",
  searchPlaceholder: "Search by Mandi or State...",
  noMarketsFound: "No Markets Found",
  noMarketsFoundDesc: "Try searching for a different state or mandi name.",
  todayPrice: "Today's Price",
  bestPrice: "Best Price",
  active: "Active",
};

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────
export default function MarketsPage() {
  const t = useT();
  const params = useParams();
  const commodityId = params.id as string;

  const [commodityName, setCommodityName] = useState("");
  const [commodityNameT, setCommodityNameT] = useState("");
  const [mandisData, setMandisData] = useState<MandiResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [L, setL] = useState<UILabels>(DEFAULT_LABELS);

  // ── Translate static UI labels once on mount ──
  useEffect(() => {
    const translateLabels = async () => {
      try {
        const [
          marketsFor, loading, noMarkets, back, selectMarket,
          foundMandis, activeMandis, searchPlaceholder,
          noMarketsFound, noMarketsFoundDesc, todayPrice, bestPrice, active,
        ] = await Promise.all([
          t("Markets for"),
          t("Loading markets..."),
          t("No markets available for this commodity."),
          t("← Back to Crops"),
          t("Select Market"),
          t("active mandis for your selection."),
          t("active mandis"),
          t("Search by Mandi or State..."),
          t("No Markets Found"),
          t("Try searching for a different state or mandi name."),
          t("Today's Price"),
          t("Best Price"),
          t("Active"),
        ]);
        setL({ marketsFor, loading, noMarkets, back, selectMarket, foundMandis, activeMandis, searchPlaceholder, noMarketsFound, noMarketsFoundDesc, todayPrice, bestPrice, active });
      } catch {
        // keep defaults on failure
      }
    };
    translateLabels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch real data from Supabase ──
  useEffect(() => {
    if (!commodityId) return;

    const fetchData = async () => {
      // 1. Get commodity name
      const { data: commodity } = await supabase
        .from("commodities")
        .select("name")
        .eq("id", commodityId)
        .single();

      if (commodity) {
        setCommodityName(commodity.name);
        // Translate commodity name
        try {
          const translated = await t(commodity.name);
          setCommodityNameT(translated);
        } catch {
          setCommodityNameT(commodity.name);
        }
      }

      // 2. Get all mandi_ids for this commodity
      const { data: priceRows, error: priceError } = await supabase
        .from("price_history")
        .select("mandi_id")
        .eq("commodity_id", commodityId);

      if (priceError || !priceRows || priceRows.length === 0) {
        setLoading(false);
        return;
      }

      // 3. Unique mandi IDs
      const uniqueMandiIds = [...new Set(priceRows.map((row) => row.mandi_id))];

      // 4. Fetch mandi details
      const { data: mandis, error: mandiError } = await supabase
        .from("mandis")
        .select("*")
        .in("id", uniqueMandiIds);

      if (mandiError || !mandis) {
        setLoading(false);
        return;
      }

      const results: MandiResult[] = [];

      // 5. For each mandi get latest 2 prices
      for (const mandi of mandis) {
        const { data: prices } = await supabase
          .from("price_history")
          .select("modal_price, date")
          .eq("commodity_id", commodityId)
          .eq("mandi_id", mandi.id)
          .order("date", { ascending: false })
          .limit(2);

        let price = null;
        let trend: "up" | "down" | "flat" = "flat";

        if (prices && prices.length > 0) {
          price = prices[0].modal_price;
          if (prices.length > 1) {
            if (prices[0].modal_price > prices[1].modal_price) trend = "up";
            else if (prices[0].modal_price < prices[1].modal_price) trend = "down";
          }
        }

        results.push({ mandi, price, trend });
      }

      // Mark highest price mandi as "Best"
      const maxPrice = Math.max(...results.filter(r => r.price !== null).map(r => r.price as number));
      results.forEach(r => { if (r.price === maxPrice) r.isBest = true; });

      // Translate mandi names sequentially
      for (const result of results) {
        try {
          result.mandi = { ...result.mandi, name: await t(result.mandi.name) };
        } catch {
          // keep original name
        }
      }

      setMandisData(results);
      setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commodityId]);

  // ── Filter by search query ──
  const filtered = mandisData.filter(item =>
    item.mandi.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.mandi.state ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-green-50 font-sans pt-12 pb-20">
      <div className="max-w-[95%] mx-auto space-y-10 px-6">

        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3">
            <Link href="/commodities" className="text-green-700 font-bold flex items-center gap-1 hover:underline mb-2 w-fit">
              {L.back}
            </Link>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 capitalize">
              {L.selectMarket} — {commodityNameT || commodityName}
            </h1>
            <p className="text-lg text-slate-500 font-medium">
              {loading ? L.loading : (
                <>We found <span className="text-green-700 font-bold">{filtered.length} {L.activeMandis}</span> {L.foundMandis}</>
              )}
            </p>
          </div>

          {/* Search Bar */}
          {!loading && (
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
              <input
                type="text"
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-green-100 rounded-2xl text-slate-900 shadow-sm focus:border-green-600 outline-none placeholder:text-slate-400 font-bold transition-all"
                placeholder={L.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* ── Loading Skeletons ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-[2rem] p-8 aspect-square animate-pulse">
                <div className="flex justify-between mb-6">
                  <div className="h-6 w-16 bg-slate-100 rounded-full" />
                  <div className="h-6 w-16 bg-slate-100 rounded-full" />
                </div>
                <div className="h-7 w-3/4 bg-slate-100 rounded mb-3" />
                <div className="h-4 w-1/2 bg-slate-100 rounded" />
                <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-end">
                  <div className="h-10 w-24 bg-slate-100 rounded" />
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>

        ) : mandisData.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-green-200 rounded-[2rem] py-24 text-center">
            <Navigation className="w-16 h-16 text-green-200 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-800">{L.noMarkets}</h3>
          </div>

        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-green-200 rounded-[2rem] py-24 text-center">
            <Navigation className="w-16 h-16 text-green-200 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-800">{L.noMarketsFound}</h3>
            <p className="text-slate-500 font-medium mt-2">{L.noMarketsFoundDesc}</p>
          </div>

        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((item) => (
              <Link
                key={item.mandi.id}
                href={`/dashboard/${commodityId}/${item.mandi.id}`}
                className="group relative bg-white border border-slate-200 rounded-[2rem] p-6 transition-all hover:border-green-600 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
              >
                {/* Top Badge Row */}
                <div className="flex justify-between items-start mb-4 gap-2">
                  {item.isBest ? (
                    <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 border border-yellow-200 shrink-0">
                      <Award className="w-3 h-3" /> {L.bestPrice}
                    </div>
                  ) : (
                    <div className="bg-slate-50 text-slate-400 px-2 py-1 rounded-full text-[10px] font-black uppercase border border-slate-100 shrink-0">
                      {L.active}
                    </div>
                  )}

                  {item.trend === "up" ? (
                    <span className="flex items-center text-xs font-black text-green-700 bg-green-50 px-2 py-1 rounded-lg shrink-0">
                      <TrendingUp className="w-3 h-3 mr-1" /> ▲
                    </span>
                  ) : item.trend === "down" ? (
                    <span className="flex items-center text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg shrink-0">
                      <TrendingDown className="w-3 h-3 mr-1" /> ▼
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg shrink-0">
                      —
                    </span>
                  )}
                </div>

                {/* Mandi Info */}
                <div className="flex-1 space-y-1 overflow-hidden">
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-green-700 transition-colors leading-snug line-clamp-2 break-words">
                    {item.mandi.name}
                  </h3>
                  {item.mandi.state && (
                    <p className="text-slate-400 font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px] truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {item.mandi.state}
                    </p>
                  )}
                </div>

                {/* Price Display */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {L.todayPrice}
                      </p>
                      <h4 className="text-2xl font-black text-slate-900 group-hover:text-green-800 transition-colors truncate">
                        {item.price !== null ? `₹${Number(item.price).toLocaleString("en-IN")}` : "—"}
                      </h4>
                    </div>
                    <div className="w-10 h-10 shrink-0 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-green-600 group-hover:border-green-600 transition-all">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>

                {/* Hover bottom bar */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-green-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-b-[2rem]" />
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
