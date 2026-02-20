"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [commodities, setCommodities] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("commodities")
        .select("*");

      if (error) console.error(error);
      else setCommodities(data);
    };

    fetchData();
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-6">Available Crops</h1>

      <ul className="space-y-2">
        {commodities.map((item) => (
          <li key={item.id} className="p-4 bg-white shadow rounded">
            {item.name}
          </li>
        ))}
      </ul>
    </main>
  );
}