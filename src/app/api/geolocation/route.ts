import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,lat,lon,city,regionName,country`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    if (data.status !== "success") throw new Error("IP lookup failed");

    return NextResponse.json({ lat: data.lat, lng: data.lon });
  } catch {
    return NextResponse.json(
      { error: "Could not determine location" },
      { status: 500 }
    );
  }
}
