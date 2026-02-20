"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import MandiCard from "@/components/MandiCard";

export default function MarketsPage() {
  const t = useT();
  const params = useParams();
  const commodityId = params.id as string;

  const [commodityName, setCommodityName] = useState("");
  const [mandisData, setMandisData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!commodityId) return;

    const fetchData = async () => {
      console.log("Selected Commodity ID:", commodityId);

      // 🔹 1. Get Commodity Name
      const { data: commodity } = await supabase
        .from("commodities")
        .select("name")
        .eq("id", commodityId)
        .single();

      if (commodity) {
        setCommodityName(commodity.name);
        console.log("Commodity Name:", commodity.name);
      }

      // 🔹 2. Get all mandi_ids that have price data for this commodity
      const { data: priceRows, error: priceError } = await supabase
        .from("price_history")
        .select("mandi_id")
        .eq("commodity_id", commodityId);

      if (priceError) {
        console.error("Price fetch error:", priceError);
        return;
      }

      if (!priceRows || priceRows.length === 0) {
        console.log("No price data found for this commodity.");
        setLoading(false);
        return;
      }

      // 🔹 3. Remove duplicate mandi IDs
      const uniqueMandiIds = [
        ...new Set(priceRows.map((row) => row.mandi_id)),
      ];

      console.log("Unique Mandi IDs:", uniqueMandiIds);

      // 🔹 4. Fetch mandi details
      const { data: mandis, error: mandiError } = await supabase
        .from("mandis")
        .select("*")
        .in("id", uniqueMandiIds);

      if (mandiError) {
        console.error("Mandi fetch error:", mandiError);
        return;
      }

      if (!mandis) {
        setLoading(false);
        return;
      }

      const results = [];

      // 🔹 5. For each mandi get latest 2 prices
      for (const mandi of mandis) {
        console.log("Checking Mandi:", mandi.name);

        const { data: prices, error } = await supabase
          .from("price_history")
          .select("modal_price, date")
          .eq("commodity_id", commodityId)
          .eq("mandi_id", mandi.id)
          .order("date", { ascending: false })
          .limit(2);

        if (error) {
          console.error("Price query error:", error);
          continue;
        }

        console.log("Returned Prices:", prices);

        let price = null;
        let trend: "up" | "down" | "flat" = "flat";

        if (prices && prices.length > 0) {
          price = prices[0].modal_price;

          if (prices.length > 1) {
            if (prices[0].modal_price > prices[1].modal_price)
              trend = "up";
            else if (prices[0].modal_price < prices[1].modal_price)
              trend = "down";
          }
        }

        results.push({
          mandi,
          price,
          trend,
        });
      }

      setMandisData(results);
      setLoading(false);
    };

    fetchData();
  }, [commodityId]);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6">
        {t("Markets for")} {commodityName}
      </h1>

      {loading ? (
        <p>{t("Loading markets...")}</p>
      ) : mandisData.length === 0 ? (
        <p>{t("No markets available for this commodity.")}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {mandisData.map((item) => (
            <MandiCard
              key={item.mandi.id} // ✅ Unique key fixed
              mandiId={item.mandi.id}
              mandiName={item.mandi.name}
              state={item.mandi.state}
              price={item.price}
              trend={item.trend}
              commodityId={commodityId}
            />
          ))}
        </div>
      )}
    </main>
  );
}