"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/TranslatorProvider";
import { Commodity } from "@/types/commodity";
import CommodityCard from "@/components/CommodityCard";

export default function CommoditiesPage() {
  const t = useT();
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommodities = async () => {
      const { data, error } = await supabase
        .from("commodities")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
      } else {
        setCommodities(data as Commodity[]);
      }

      setLoading(false);
    };

    fetchCommodities();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-green-700 mb-8">
          {t("Select Your Crop 🌾")}
        </h1>

        {loading ? (
          <p className="text-gray-600">{t("Loading crops...")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {commodities.map((commodity) => (
              <CommodityCard
                key={commodity.id}
                commodity={commodity}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}