import { fetchMandiData } from "@/lib/data/fetchMandiData";
import { normalizeRecord } from "@/lib/data/normalizeData";
import { upsertPrice } from "@/lib/data/upsertPrices";

export async function GET() {
  const rawData = await fetchMandiData();

  for (const record of rawData) {
    const normalized = normalizeRecord(record);
    await upsertPrice(normalized);
  }

  console.log(rawData[0]);
  return Response.json({ message: "Sync complete" });
  console.log(rawData.length);
}
