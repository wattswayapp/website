import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const originLat = request.nextUrl.searchParams.get("originLat");
  const originLng = request.nextUrl.searchParams.get("originLng");
  const destLat = request.nextUrl.searchParams.get("destLat");
  const destLng = request.nextUrl.searchParams.get("destLng");

  if (!originLat || !originLng || !destLat || !destLng) {
    return NextResponse.json(
      { error: "Origin and destination coordinates required" },
      { status: 400 }
    );
  }

  try {
    // OSRM public routing API
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Routing failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return NextResponse.json(
        { error: "No route found" },
        { status: 404 }
      );
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates.map(
      (coord: [number, number]) => ({
        lat: coord[1],
        lng: coord[0],
      })
    );

    return NextResponse.json({
      distance: route.distance / 1609.34, // meters to miles
      duration: route.duration / 60, // seconds to minutes
      polyline: coordinates,
    });
  } catch (error) {
    console.error("Route error:", error);
    return NextResponse.json(
      { error: "Failed to calculate route" },
      { status: 500 }
    );
  }
}
