import { NextRequest, NextResponse } from "next/server";

const PRIVATE_IP =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fc|fd|fe80)/;

export async function GET(request: NextRequest) {
  const raw =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";

  // Omit private/localhost IPs so ip-api.com resolves via the requester's public IP
  const ip = raw && !PRIVATE_IP.test(raw) ? raw : "";
  const url = ip
    ? `http://ip-api.com/json/${ip}?fields=status,lat,lon`
    : `http://ip-api.com/json?fields=status,lat,lon`;

  try {
    const res = await fetch(url);
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
