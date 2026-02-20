import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { texts } = await req.json();

  try {
    const results = await Promise.all(
      texts.map(async (text: string) => {
        try {
          const res = await fetch(
            `https://lingva.ml/api/v1/en/hi/${encodeURIComponent(text)}`
          );

          const data = await res.json();

          return data.translation || text;
        } catch {
          return text;
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ results: texts });
  }
}