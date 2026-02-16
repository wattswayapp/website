import { NextRequest, NextResponse } from "next/server";
import { LatLng, TrafficCongestion } from "@/lib/types";

function samplePoints(polyline: LatLng[], count: number): LatLng[] {
  if (polyline.length <= count) return polyline;
  const points: LatLng[] = [];
  const step = (polyline.length - 1) / (count - 1);
  for (let i = 0; i < count; i++) {
    const idx = Math.round(i * step);
    points.push(polyline[idx]);
  }
  return points;
}

function getCongestionLevel(ratio: number): {
  level: TrafficCongestion["level"];
  color: string;
} {
  if (ratio < 0.15) return { level: "Light", color: "#22c55e" };
  if (ratio < 0.35) return { level: "Moderate", color: "#eab308" };
  if (ratio < 0.55) return { level: "Heavy", color: "#f97316" };
  return { level: "Severe", color: "#ef4444" };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || process.env.TOMTOM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TomTom API key not configured" },
      { status: 503 }
    );
  }

  let body: { polyline: LatLng[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.polyline || !Array.isArray(body.polyline) || body.polyline.length < 2) {
    return NextResponse.json(
      { error: "polyline must be an array of at least 2 LatLng points" },
      { status: 400 }
    );
  }

  const points = samplePoints(body.polyline, 10);

  const results = await Promise.allSettled(
    points.map(async (point) => {
      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${point.lat},${point.lng}&key=${apiKey}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const data = await res.json();
        return data.flowSegmentData ?? null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const segments = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter(Boolean);

  if (segments.length === 0) {
    return NextResponse.json(
      { error: "Could not fetch traffic data for any sample points" },
      { status: 502 }
    );
  }

  let totalCongestion = 0;
  let totalDelay = 0;

  for (const seg of segments) {
    const freeFlow = seg.freeFlowSpeed ?? 1;
    const current = seg.currentSpeed ?? freeFlow;
    const ratio = Math.max(0, 1 - current / freeFlow);
    totalCongestion += ratio;

    const freeTime = seg.freeFlowTravelTime ?? 0;
    const currentTime = seg.currentTravelTime ?? 0;
    totalDelay += Math.max(0, currentTime - freeTime);
  }

  const averageCongestion = totalCongestion / segments.length;
  const estimatedDelayMinutes = Math.round(totalDelay / 60);
  const { level, color } = getCongestionLevel(averageCongestion);

  const result: TrafficCongestion = {
    averageCongestion: Math.round(averageCongestion * 100) / 100,
    sampleCount: segments.length,
    estimatedDelayMinutes,
    level,
    color,
  };

  return NextResponse.json(result);
}
