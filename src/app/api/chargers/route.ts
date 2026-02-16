import { NextRequest, NextResponse } from "next/server";
import { ChargerStation } from "@/lib/types";

// In-memory cache for supercharger data (refreshed every 30 min)
let superchargerCache: any[] | null = null;
let superchargerCacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

async function getAllSuperchargers(): Promise<any[]> {
  const now = Date.now();
  if (superchargerCache && now - superchargerCacheTime < CACHE_TTL) {
    return superchargerCache;
  }
  try {
    const res = await fetch(
      "https://supercharge.info/service/supercharge/allSites"
    );
    if (!res.ok) throw new Error(`Supercharge.info API: ${res.status}`);
    superchargerCache = await res.json();
    superchargerCacheTime = now;
    return superchargerCache!;
  } catch (err) {
    console.error("Failed to fetch superchargers:", err);
    return superchargerCache || [];
  }
}

function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseSuperchargerSite(site: any, seenLocations: Set<string>): ChargerStation | null {
  const sLat = site.gps?.latitude;
  const sLng = site.gps?.longitude;
  if (!sLat || !sLng) return null;

  const key = `${sLat.toFixed(4)},${sLng.toFixed(4)}`;
  if (seenLocations.has(key)) return null;
  seenLocations.add(key);

  const addressParts = [
    site.address?.street,
    site.address?.city,
    site.address?.state,
    site.address?.country,
  ].filter(Boolean);

  return {
    id: `sc-${site.id}`,
    name: site.name
      ? `Tesla Supercharger - ${site.name}`
      : "Tesla Supercharger",
    location: { lat: sLat, lng: sLng },
    address: addressParts.length > 0 ? addressParts.join(", ") : `${sLat.toFixed(4)}, ${sLng.toFixed(4)}`,
    numStalls: site.stallCount || 8,
    power: site.powerKilowatt || 250,
    status: "available",
    network: "Tesla Supercharger",
    locationId: site.locationId || undefined,
  };
}

function parseOverpassElement(el: any, seenLocations: Set<string>): ChargerStation | null {
  const elLat = el.lat ?? el.center?.lat;
  const elLng = el.lon ?? el.center?.lon;
  if (!elLat || !elLng) return null;

  const key = `${elLat.toFixed(4)},${elLng.toFixed(4)}`;
  if (seenLocations.has(key)) return null;
  seenLocations.add(key);

  const tags = el.tags || {};
  const operator = tags.operator || tags.network || tags.brand || "";

  if (operator.toLowerCase().includes("tesla")) return null;

  const capacity = parseInt(tags.capacity || tags.sockets || "0", 10);

  let power = 0;
  const outputTag =
    tags["socket:type2_combo:output"] ||
    tags["socket:chademo:output"] ||
    tags["charging_station:output"] ||
    "";
  const powerMatch = outputTag.match(/([\d.]+)\s*kW/i);
  if (powerMatch) power = parseFloat(powerMatch[1]);
  if (power === 0) power = 150;

  const name =
    tags.name || (operator ? `${operator} Charger` : "DC Fast Charger");

  const addressParts = [
    tags["addr:street"]
      ? `${tags["addr:housenumber"] || ""} ${tags["addr:street"]}`.trim()
      : "",
    tags["addr:city"] || "",
    tags["addr:state"] || tags["addr:postcode"] || "",
    tags["addr:country"] || "",
  ].filter(Boolean);

  const address = addressParts.length > 0
    ? addressParts.join(", ")
    : `${elLat.toFixed(4)}, ${elLng.toFixed(4)}`;

  return {
    id: `osm-${el.id}`,
    name,
    location: { lat: elLat, lng: elLng },
    address,
    numStalls: capacity > 0 ? capacity : 2,
    power,
    status: "unknown",
    network: operator || "Unknown",
  };
}

const OVERPASS_SERVERS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

async function queryOverpass(query: string, timeoutMs = 15000): Promise<any> {
  for (const server of OVERPASS_SERVERS) {
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("json")) continue;

      return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

// --- Single-point radius query ---
export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") || "");
  const radiusMiles = parseFloat(
    request.nextUrl.searchParams.get("radius") || "30"
  );

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Valid lat and lng parameters required" },
      { status: 400 }
    );
  }

  const chargers: ChargerStation[] = [];
  const seenLocations = new Set<string>();

  try {
    const allSites = await getAllSuperchargers();
    for (const site of allSites) {
      if (site.status !== "OPEN") continue;
      const sLat = site.gps?.latitude;
      const sLng = site.gps?.longitude;
      if (!sLat || !sLng) continue;
      if (haversineDistanceMiles(lat, lng, sLat, sLng) > radiusMiles) continue;
      const c = parseSuperchargerSite(site, seenLocations);
      if (c) chargers.push(c);
    }
  } catch (err) {
    console.error("Supercharger fetch error:", err);
  }

  try {
    const radiusMeters = Math.round(radiusMiles * 1609.34);
    const overpassQuery = `[out:json][timeout:10];(node["amenity"="charging_station"]["socket:type2_combo"](around:${radiusMeters},${lat},${lng});node["amenity"="charging_station"]["socket:chademo"](around:${radiusMeters},${lat},${lng}););out body;`;
    const data = await queryOverpass(overpassQuery);
    if (data) {
      for (const el of data.elements || []) {
        const c = parseOverpassElement(el, seenLocations);
        if (c) chargers.push(c);
      }
    }
  } catch (err) {
    console.error("Overpass fetch error:", err);
  }

  return NextResponse.json(chargers);
}

// --- Batch bounding-box query (used by route planner) ---
export async function POST(request: NextRequest) {
  let body: {
    south: number;
    west: number;
    north: number;
    east: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { south, west, north, east } = body;
  if ([south, west, north, east].some((v) => typeof v !== "number" || isNaN(v))) {
    return NextResponse.json(
      { error: "south, west, north, east are required numbers" },
      { status: 400 }
    );
  }

  const chargers: ChargerStation[] = [];
  const seenLocations = new Set<string>();

  // --- Tesla Superchargers (instant — from cache) ---
  try {
    const allSites = await getAllSuperchargers();
    for (const site of allSites) {
      if (site.status !== "OPEN") continue;
      const sLat = site.gps?.latitude;
      const sLng = site.gps?.longitude;
      if (!sLat || !sLng) continue;
      if (sLat < south || sLat > north || sLng < west || sLng > east) continue;
      const c = parseSuperchargerSite(site, seenLocations);
      if (c) chargers.push(c);
    }
  } catch (err) {
    console.error("Supercharger fetch error:", err);
  }

  // --- Overpass: split large bbox into smaller tiles to avoid timeout ---
  try {
    const latSpan = north - south;
    const lngSpan = east - west;
    // Split into tiles of roughly 2 degrees (~140km) max
    const tileSize = 2;
    const latTiles = Math.ceil(latSpan / tileSize);
    const lngTiles = Math.ceil(lngSpan / tileSize);
    const totalTiles = latTiles * lngTiles;

    // Cap at 20 tiles to support longer routes while avoiding abuse
    if (totalTiles <= 20) {
      const tiles: string[] = [];
      for (let i = 0; i < latTiles; i++) {
        for (let j = 0; j < lngTiles; j++) {
          const s = south + i * tileSize;
          const n = Math.min(south + (i + 1) * tileSize, north);
          const w = west + j * tileSize;
          const e = Math.min(west + (j + 1) * tileSize, east);
          tiles.push(`${s},${w},${n},${e}`);
        }
      }

      // Query tiles in parallel batches of 3 to stay within rate limits
      const BATCH_SIZE = 3;
      for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
        const batch = tiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((bbox) => {
            const q = `[out:json][timeout:10];(node["amenity"="charging_station"]["socket:type2_combo"](${bbox});node["amenity"="charging_station"]["socket:chademo"](${bbox}););out body;`;
            return queryOverpass(q, 12000);
          })
        );
        for (const data of results) {
          if (data) {
            for (const el of data.elements || []) {
              const c = parseOverpassElement(el, seenLocations);
              if (c) chargers.push(c);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Overpass bbox fetch error:", err);
  }

  return NextResponse.json(chargers);
}
