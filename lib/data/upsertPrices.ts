import { supabase } from "../supabaseClient";

export async function upsertPrice(normalized: any) {
  const {
    commodity_name,
    mandi_name,
    state,
    modal_price,
    date,
  } = normalized;

  // 🟢 1️⃣ Find or create commodity
  let { data: commodity } = await supabase
    .from("commodities")
    .select("id")
    .eq("name", commodity_name.trim())
    .single();

  if (!commodity) {
    const { data: newCommodity } = await supabase
      .from("commodities")
      .insert({
        name: commodity_name.trim(),
        category: "General",
      })
      .select("id")
      .single();

    commodity = newCommodity;
  }

  // 🟢 2️⃣ Find or create mandi
  let { data: mandi } = await supabase
    .from("mandis")
    .select("id")
    .eq("name", mandi_name.trim())
    .single();

  if (!mandi) {
    const { data: newMandi } = await supabase
      .from("mandis")
      .insert({
        name: mandi_name.trim(),
        state,
      })
      .select("id")
      .single();

    mandi = newMandi;
  }

  // 🟢 3️⃣ Insert price
  await supabase.from("price_history").upsert(
    {
      commodity_id: commodity.id,
      mandi_id: mandi.id,
      date,
      modal_price,
    },
    {
      onConflict: "commodity_id,mandi_id,date",
    }
  );
}