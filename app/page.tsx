"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useT } from "@/components/TranslatorProvider";
import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface LiveCrop {
  commodity_id: string;
  commodity_name: string;
  mandi_id: string;
  mandi_name: string;
  modal_price: number;
  trend: number | null;
}

interface DBStats {
  totalMandis: number;
  totalCommodities: number;
  totalRecords: number;
}

// ─────────────────────────────────────────────
// ANIMATED COUNTER
// ─────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const step = Math.max(target / 60, 1);
          const timer = setInterval(() => {
            start += step;
            if (start >= target) { setCount(target); clearInterval(timer); }
            else setCount(Math.floor(start));
          }, 16);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString("en-IN")}{suffix}</span>;
}

// ─────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────
function FeatureCard({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300 }}
      style={{
        background: "white", borderRadius: 16, padding: "40px 32px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)", position: "relative",
        overflow: "hidden", cursor: "default",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 4, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div style={{ fontSize: 48, marginBottom: 20 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 12, lineHeight: 1.3, color: "#1a2e05" }}>
        {title}
      </h3>
      <p style={{ fontFamily: "'Source Sans 3', sans-serif", color: "#6b7280", lineHeight: 1.7, fontSize: 15 }}>
        {desc}
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// CROP EMOJI MAP
// ─────────────────────────────────────────────
const CROP_EMOJIS: Record<string, string> = {
  wheat: "🌾", rice: "🍚", onion: "🧅", potato: "🥔", tomato: "🍅",
  cauliflower: "🥦", "bottle gourd": "🥒", amaranthus: "🌿",
  maize: "🌽", soybean: "🫘", brinjal: "🍆", carrot: "🥕",
  cabbage: "🥬", garlic: "🧄", chilli: "🌶️", pea: "🫛",
};
function getCropEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const key of Object.keys(CROP_EMOJIS)) {
    if (lower.includes(key)) return CROP_EMOJIS[key];
  }
  return "🌱";
}

// ─────────────────────────────────────────────
// HOMEPAGE
// ─────────────────────────────────────────────
export default function HomePage() {
  const t = useT();
  const [speaking, setSpeaking] = useState(false);
  const [liveCrops, setLiveCrops] = useState<LiveCrop[]>([]);
  const [stats, setStats] = useState<DBStats>({ totalMandis: 0, totalCommodities: 0, totalRecords: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  // ── Fetch live data ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: priceData, error } = await supabase
          .from("price_history")
          .select(`
            modal_price, date, commodity_id, mandi_id,
            commodities ( name ),
            mandis ( name )
          `)
          .order("date", { ascending: false })
          .limit(40);

        if (error) console.error("❌ Homepage price error:", error);

        if (priceData && priceData.length > 0) {
          const seen = new Set<string>();
          const unique: any[] = [];
          for (const row of priceData) {
            if (!seen.has(row.commodity_id)) {
              seen.add(row.commodity_id);
              unique.push(row);
            }
          }

          const latestDate = unique[0]?.date;
          const { data: prevData } = await supabase
            .from("price_history")
            .select("commodity_id, modal_price")
            .in("commodity_id", unique.map((u: any) => u.commodity_id))
            .lt("date", latestDate)
            .order("date", { ascending: false })
            .limit(unique.length * 2);

          const prevMap = new Map<string, number>();
          if (prevData) {
            for (const p of prevData) {
              if (!prevMap.has(p.commodity_id)) prevMap.set(p.commodity_id, Number(p.modal_price));
            }
          }

          const crops: LiveCrop[] = unique.slice(0, 8).map((u: any) => {
            const prev = prevMap.get(u.commodity_id);
            const modalPrice = Number(u.modal_price);
            const trend = prev && prev > 0 ? ((modalPrice - prev) / prev) * 100 : null;
            return {
              commodity_id: u.commodity_id,
              commodity_name: (u.commodities as any)?.name ?? "Unknown",
              mandi_id: u.mandi_id,
              mandi_name: (u.mandis as any)?.name ?? "Unknown",
              modal_price: modalPrice,
              trend,
            };
          });
          setLiveCrops(crops);
        }

        // DB stats
        const [mandiRes, commRes, recRes] = await Promise.allSettled([
          supabase.from("mandis").select("id", { count: "exact", head: true }),
          supabase.from("commodities").select("id", { count: "exact", head: true }),
          supabase.from("price_history").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          totalMandis: mandiRes.status === "fulfilled" ? mandiRes.value.count ?? 0 : 0,
          totalCommodities: commRes.status === "fulfilled" ? commRes.value.count ?? 0 : 0,
          totalRecords: recRes.status === "fulfilled" ? recRes.value.count ?? 0 : 0,
        });
      } catch (err) {
        console.error("❌ Homepage fetch failed:", err);
      } finally {
        setDataLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Voice readout ──
  const handleSpeak = () => {
    if (!window.speechSynthesis) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const priceText = liveCrops.length > 0
      ? liveCrops.slice(0, 4).map(c => `${c.commodity_name} at ${c.modal_price} rupees${c.trend !== null ? `, ${c.trend >= 0 ? "up" : "down"} ${Math.abs(c.trend).toFixed(1)} percent` : ""}`).join(". ")
      : "market data is loading";
    const utterance = new SpeechSynthesisUtterance(
      `Welcome to KisanSense. Today's market prices: ${priceText}. Open any crop card for full AI analysis and sell recommendations.`
    );
    utterance.lang = "en-IN";
    utterance.rate = 0.92;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const features = [
    { icon: "📡", title: t("Real-time Mandi Prices"), desc: t("Live prices from mandis across India, updated daily from Agmarknet data."), accent: "#16a34a" },
    { icon: "🤖", title: t("AI Price Prediction"), desc: t("Machine learning models trained on market data tell you when to sell for maximum profit."), accent: "#ca8a04" },
    { icon: "💰", title: t("Market Risk Analysis"), desc: t("Understand price volatility and stability before making your selling decision."), accent: "#65a30d" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#fefce8", color: "#1a2e05", overflowX: "hidden", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Sans+3:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes shimmer {
          0% { background-position: -200% 0; } 100% { background-position: 200% 0; }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(3deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.15); }
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1.5); }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #15803d, #65a30d, #ca8a04, #15803d);
          background-size: 200% auto; -webkit-background-clip: text;
          -webkit-text-fill-color: transparent; background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .float-anim { animation: floatSlow 5s ease-in-out infinite; }
        .crop-card {
          display: block; text-decoration: none; background: #fafafa;
          border-radius: 12px; padding: 28px 20px; text-align: center;
          border: 2px solid transparent; color: inherit;
          transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .crop-card:hover {
          transform: translateY(-8px) scale(1.03); border-color: #16a34a;
          box-shadow: 0 20px 40px rgba(22,163,74,0.2); background: white;
        }
        .btn-primary {
          background: linear-gradient(135deg, #16a34a, #15803d); color: white;
          border: none; padding: 16px 36px; border-radius: 6px; font-size: 16px;
          font-family: 'Source Sans 3', sans-serif; font-weight: 600;
          cursor: pointer; letter-spacing: 0.5px; transition: all 0.3s ease;
          text-decoration: none; display: inline-block;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(22,163,74,0.4); }
        .btn-secondary {
          background: #fbbf24; color: #1a2e05; border: none;
          padding: 16px 36px; border-radius: 6px; font-size: 16px;
          font-family: 'Source Sans 3', sans-serif; font-weight: 600;
          cursor: pointer; letter-spacing: 0.5px; transition: all 0.3s ease;
        }
        .btn-secondary:hover { background: #f59e0b; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(251,191,36,0.4); }
        .wave-bar {
          display: inline-block; width: 4px; height: 20px; background: #16a34a;
          border-radius: 2px; margin: 0 2px; animation: wave 1.2s ease-in-out infinite;
        }
        .sun-deco {
          position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%);
        }
        .skeleton {
          background: linear-gradient(90deg, #f0fdf4 25%, #dcfce7 50%, #f0fdf4 75%);
          background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 12px;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #fefce8; }
        ::-webkit-scrollbar-thumb { background: #16a34a; border-radius: 3px; }

        /* Responsive feature grid */
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }
        @media (max-width: 768px) {
          .feature-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Responsive stats grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
        .stat-item {
          text-align: center;
          padding: 32px;
        }
        @media (max-width: 768px) {
          .stat-item {
            padding: 20px;
          }
        }
        @media (max-width: 480px) {
          .stat-item {
            padding: 16px;
          }
        }
      `}</style>

      {/* ── HERO ── */}
      <section style={{ position: "relative", overflow: "hidden", minHeight: "88vh", display: "flex", alignItems: "center", padding: "80px 40px" }}>
        <div className="sun-deco" style={{ width: 600, height: 600, top: -200, right: -150 }} />
        <div className="sun-deco" style={{ width: 300, height: 300, bottom: -100, left: -80 }} />
        <div className="float-anim" style={{ position: "absolute", top: 120, right: "12%", fontSize: 64, opacity: 0.1, pointerEvents: "none" }}>🌾</div>
        <div className="float-anim" style={{ position: "absolute", bottom: 160, right: "26%", fontSize: 48, opacity: 0.08, animationDelay: "2s", pointerEvents: "none" }}>🌿</div>
        <div style={{ position: "absolute", top: 80, left: "8%", width: 120, height: 120, border: "1px solid rgba(22,163,74,0.18)", borderRadius: "50%", animation: "pulse-glow 4s ease-in-out infinite", pointerEvents: "none" }} />

        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", width: "100%" }}>
          {/* Live badge */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.22)", borderRadius: 20, padding: "6px 16px", marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse-glow 2s infinite" }} />
            <span style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, fontWeight: 600, color: "#15803d", letterSpacing: 0.5 }}>
              {dataLoading ? "CONNECTING TO MARKETS..." : stats.totalRecords > 0 ? `LIVE · ${stats.totalRecords.toLocaleString("en-IN")} PRICE RECORDS` : "LIVE MARKET DATA"}
            </span>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(48px, 6vw, 80px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-3px", marginBottom: 28 }}>
            {t("AI Market")}
            <br />
            <span className="shimmer-text">{t("Intelligence")}</span>
            <br />
            {t("for Farmers")}
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 19, color: "#4b5563", lineHeight: 1.7, maxWidth: 520, margin: "0 auto 44px" }}>
            {t("Check mandi prices across India. Predict when prices will rise. Decide the perfect moment to sell your harvest.")}
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 64 }}>
            <Link href="/commodities" className="btn-primary">{t("Explore Markets")} →</Link>
            <button className="btn-secondary" onClick={handleSpeak}>
              {speaking ? `⏹ ${t("Stop")}` : `🔊 ${t("Hear Market Insights")}`}
            </button>
          </motion.div>

          {speaking && (
            <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 32 }}>
              {[0, 1, 2, 3, 4].map(i => <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>
          )}

          {/* Real DB counters */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            style={{ display: "flex", gap: 56, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { target: stats.totalMandis, suf: "+", label: t("Mandis") },
              { target: stats.totalCommodities, suf: "", label: t("Commodities") },
              { target: stats.totalRecords, suf: "+", label: t("Price Records") },
            ].map(({ target, suf, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: "#15803d", lineHeight: 1 }}>
                  <AnimatedCounter target={target} suffix={suf} />
                </div>
                <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: "#6b7280", fontWeight: 600, letterSpacing: 0.8, marginTop: 4, textTransform: "uppercase" }}>
                  {label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── LIVE CROPS ── */}
      <section style={{ background: "white", padding: "80px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 700, color: "#16a34a", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              {t("Live from Database")}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 800, letterSpacing: "-1px", color: "#1a2e05" }}>
              {t("Today's Market Prices")}
            </h2>
          </div>

          {dataLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="skeleton" style={{ height: 180 }} />)}
            </div>
          ) : liveCrops.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
              {liveCrops.map(crop => {
                const trendUp = crop.trend === null ? null : crop.trend >= 0;
                return (
                  <Link key={crop.commodity_id} href={`/dashboard/${crop.commodity_id}/${crop.mandi_id}`} className="crop-card">
                    <div style={{ fontSize: 42, marginBottom: 10 }}>{getCropEmoji(crop.commodity_name)}</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, marginBottom: 4, color: "#1a2e05" }}>
                      {crop.commodity_name}
                    </div>
                    <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
                      📍 {crop.mandi_name}
                    </div>
                    <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 22, fontWeight: 800, color: "#15803d" }}>
                      ₹{crop.modal_price.toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 700, marginTop: 5, color: trendUp === null ? "#d1d5db" : trendUp ? "#16a34a" : "#dc2626" }}>
                      {trendUp === null ? "— no prior data" : trendUp ? `▲ +${crop.trend!.toFixed(1)}%` : `▼ ${crop.trend!.toFixed(1)}%`}
                    </div>
                    <div style={{ marginTop: 10, display: "inline-block", fontFamily: "'Source Sans 3', sans-serif", fontSize: 11, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "3px 8px" }}>
                      {t("View Intelligence →")}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "#f9fafb", borderRadius: 16, border: "2px dashed #d1fae5" }}>
              <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 16, color: "#6b7280", marginBottom: 12 }}>{t("No price data found.")}</p>
              <Link href="/commodities" style={{ color: "#16a34a", fontFamily: "'Source Sans 3', sans-serif", fontWeight: 600, fontSize: 14 }}>
                {t("Browse all commodities →")}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "100px 40px", background: "#fefce8", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #16a34a44, transparent)" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, fontWeight: 700, color: "#ca8a04", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              {t("What We Offer")}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 800, letterSpacing: "-1.5px", color: "#1a2e05" }}>
              {t("How KisanSense Helps")}
            </h2>
          </div>
          <div className="feature-grid">
            {features.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section style={{ background: "#15803d", padding: "64px 40px" }}>
        <div className="stats-grid">
          {[
            { target: stats.totalMandis, suf: "+", label: t("Mandis Connected") },
            { target: stats.totalCommodities, suf: "+", label: t("Commodities Tracked") },
            { target: stats.totalRecords, suf: "+", label: t("Price Data Points") },
            { target: 95, suf: "%", label: t("Prediction Accuracy") },
          ].map(({ target, suf, label }) => (
            <div key={label} className="stat-item">
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, fontWeight: 900, color: "#fbbf24", lineHeight: 1 }}>
                <AnimatedCounter target={target} suffix={suf} />
              </div>
              <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, color: "#bbf7d0", marginTop: 8, fontWeight: 600, letterSpacing: 0.5 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── VOICE SECTION ── */}
      <section style={{ padding: "100px 40px", background: "white" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, background: "linear-gradient(135deg, #16a34a, #65a30d)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 28px", boxShadow: "0 16px 40px rgba(22,163,74,0.3)" }}>
            🎙️
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 800, letterSpacing: "-1px", marginBottom: 16, color: "#1a2e05" }}>
            {t("Listen in your language")}
          </h2>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 18, color: "#6b7280", lineHeight: 1.7, marginBottom: 40 }}>
            {t("Not comfortable reading? Press the button below to hear today's market insights read aloud.")}
          </p>
          <button onClick={handleSpeak} style={{
            display: "inline-flex", alignItems: "center", gap: 14,
            background: speaking ? "linear-gradient(135deg, #dc2626, #b91c1c)" : "linear-gradient(135deg, #16a34a, #15803d)",
            color: "white", border: "none", borderRadius: 8,
            padding: "18px 44px", fontSize: 17,
            fontFamily: "'Source Sans 3', sans-serif", fontWeight: 700,
            cursor: "pointer",
            boxShadow: speaking ? "0 12px 32px rgba(220,38,38,0.35)" : "0 12px 32px rgba(22,163,74,0.35)",
            transition: "all 0.3s ease",
          }}>
            <span style={{ fontSize: 22 }}>{speaking ? "⏹" : "🔊"}</span>
            {speaking ? t("Stop Reading") : t("Read Aloud — Today's Market Insights")}
          </button>
          {speaking && (
            <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 20 }}>
              {[0, 1, 2, 3, 4].map(i => <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0f1f05", color: "#9ca3af", padding: "48px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌾</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#4ade80" }}>KisanSense</span>
          </div>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, letterSpacing: 0.5 }}>
            {t("Built for farmers")} · Hackathon Project · {new Date().getFullYear()}
          </p>
          <div style={{ display: "flex", gap: 20 }}>
            {["Privacy", "Terms", "Contact"].map(item => (
              <a key={item} href="#"
                style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 13, color: "#9ca3af", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => ((e.target as HTMLElement).style.color = "#4ade80")}
                onMouseLeave={e => ((e.target as HTMLElement).style.color = "#9ca3af")}
              >
                {t(item)}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
