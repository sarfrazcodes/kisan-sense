import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { texts } = await req.json();

  try {
    const results = await Promise.all(
      texts.map(async (text: string) => {
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(
            text
          )}`
        );

        const data = await res.json();

        return data?.[0]?.[0]?.[0] || text;
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ results: texts });
  }
}