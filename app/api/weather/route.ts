import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const location = req.nextUrl.searchParams.get("location");

    if (!location) {
      return NextResponse.json(
        { error: "Location required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      console.log("❌ WEATHER_API_KEY missing");
      return NextResponse.json(
        { error: "Weather API key missing" },
        { status: 500 }
      );
    }

    // Clean mandi name (remove APMC)
    const cleanedLocation = location.replace(" APMC", "");

    console.log("🌍 Fetching weather for:", cleanedLocation);

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${cleanedLocation}&appid=${apiKey}&units=metric`
    );

    const data = await response.json();

    console.log("🌦 Raw Weather API response:", data);

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      temp: data.main.temp,
      rainProbability: data.clouds?.all || 0,
      condition: data.weather[0]?.description,
    });
  } catch (err) {
    console.log("❌ Weather route crash:", err);
    return NextResponse.json(
      { error: "Weather fetch failed" },
      { status: 500 }
    );
  }
}