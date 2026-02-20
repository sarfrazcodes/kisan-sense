// app/api/translate/route.ts
import { NextResponse } from "next/server";

async function translateWithRetry(text: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`,
        { signal: AbortSignal.timeout(5000) } // 5s timeout
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.[0]?.[0]?.[0] || text;
    } catch (err) {
      if (i === retries - 1) return text; // fallback to original on final retry
      await new Promise(r => setTimeout(r, 500 * (i + 1))); // wait 500ms, 1000ms...
    }
  }
  return text;
}

export async function POST(req: Request) {
  const { texts } = await req.json();
  try {
    const results = await Promise.all(texts.map((text: string) => translateWithRetry(text)));
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ results: texts }); // always return originals on total failure
  }
}