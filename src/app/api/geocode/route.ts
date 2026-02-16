import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");

  // Reverse geocode: ?lat=...&lng=...
  if (lat && lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`,
        {
          headers: {
            "User-Agent": "TeslaTripPlanner/1.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        return NextResponse.json(
          { error: data.error },
          { status: 404 }
        );
      }

      return NextResponse.json({
        displayName: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
      });
    } catch (error) {
      console.error("Reverse geocode error:", error);
      return NextResponse.json(
        { error: "Failed to reverse geocode location" },
        { status: 500 }
      );
    }
  }

  // Forward geocode: ?q=...
  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' or 'lat'+'lng' is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        headers: {
          "User-Agent": "TeslaTripPlanner/1.0",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    const suggestions = data.map(
      (item: {
        display_name: string;
        lat: string;
        lon: string;
      }) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      })
    );

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Geocode error:", error);
    return NextResponse.json(
      { error: "Failed to geocode location" },
      { status: 500 }
    );
  }
}
