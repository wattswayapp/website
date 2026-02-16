import { TeslaModel, ChargerStation, ChargingStop, LatLng } from "./types";

const MILES_PER_DEGREE = 69;

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function findClosestPointOnRoute(
  station: LatLng,
  route: LatLng[],
  sampleEvery = 5
): { distance: number; routeIndex: number } {
  let minDist = Infinity;
  let bestIndex = 0;
  for (let i = 0; i < route.length; i += sampleEvery) {
    const d = haversineDistance(station, route[i]);
    if (d < minDist) {
      minDist = d;
      bestIndex = i;
    }
  }
  return { distance: minDist, routeIndex: bestIndex };
}

export function cumulativeDistances(route: LatLng[]): number[] {
  const dists = [0];
  for (let i = 1; i < route.length; i++) {
    dists.push(dists[i - 1] + haversineDistance(route[i - 1], route[i]));
  }
  return dists;
}

function taperFactor(soc: number): number {
  // Realistic Tesla Supercharger taper curve
  if (soc <= 10) return 0.95;
  if (soc <= 20) return 0.92;
  if (soc <= 30) return 0.88;
  if (soc <= 40) return 0.80;
  if (soc <= 50) return 0.72;
  if (soc <= 60) return 0.60;
  if (soc <= 70) return 0.48;
  if (soc <= 80) return 0.35;
  if (soc <= 90) return 0.22;
  return 0.12;
}

export function chargeTimeMinutes(
  fromPct: number,
  toPct: number,
  model: TeslaModel
): number {
  if (toPct <= fromPct) return 0;

  // Simulate charging in small SoC increments for accurate taper modeling
  const step = 2;
  let totalMinutes = 0;

  for (let pct = fromPct; pct < toPct; pct += step) {
    const segEnd = Math.min(pct + step, toPct);
    const segMid = (pct + segEnd) / 2;
    const kwhForSeg = ((segEnd - pct) / 100) * model.batteryCapacity;
    const chargeRate = model.maxChargeRate * taperFactor(segMid);
    totalMinutes += (kwhForSeg / chargeRate) * 60;
  }

  return totalMinutes;
}

export function planChargingStops(
  route: LatLng[],
  totalDistanceMiles: number,
  chargers: ChargerStation[],
  model: TeslaModel,
  startCharge = 90
): ChargingStop[] {
  if (totalDistanceMiles <= model.range * (startCharge / 100) * 0.85) {
    return []; // Can make it without charging
  }

  const cumDist = cumulativeDistances(route);
  const routeTotalFromCoords = cumDist[cumDist.length - 1];
  const scaleFactor =
    routeTotalFromCoords > 0 ? totalDistanceMiles / routeTotalFromCoords : 1;

  // Score and sort chargers by position along route
  const maxDeviationMiles = 10;
  const stationsOnRoute = chargers
    .map((station) => {
      const { distance, routeIndex } = findClosestPointOnRoute(
        station.location,
        route
      );
      const milesFromStart = cumDist[routeIndex] * scaleFactor;
      return { station, deviationMiles: distance, milesFromStart };
    })
    .filter((s) => s.deviationMiles < maxDeviationMiles)
    .sort((a, b) => a.milesFromStart - b.milesFromStart);

  if (stationsOnRoute.length === 0) return [];

  const stops: ChargingStop[] = [];
  let currentCharge = startCharge;
  let currentMiles = 0;
  const safetyBuffer = 0.85; // Only plan to use 85% of theoretical range

  const usableRangeMiles = (pct: number) =>
    (pct / 100) * model.range * safetyBuffer;

  let i = 0;
  while (i < stationsOnRoute.length) {
    const milesRemaining = totalDistanceMiles - currentMiles;
    const canReachEnd = usableRangeMiles(currentCharge) >= milesRemaining;
    if (canReachEnd) break;

    // Find the farthest station we can reach
    let bestCandidate = -1;
    for (let j = i; j < stationsOnRoute.length; j++) {
      const distToStation =
        stationsOnRoute[j].milesFromStart - currentMiles;
      if (distToStation <= 0) continue;
      if (distToStation <= usableRangeMiles(currentCharge)) {
        bestCandidate = j;
      }
    }

    if (bestCandidate === -1) {
      // Can't reach any charger — pick the closest one ahead anyway
      for (let j = i; j < stationsOnRoute.length; j++) {
        if (stationsOnRoute[j].milesFromStart > currentMiles) {
          bestCandidate = j;
          break;
        }
      }
      if (bestCandidate === -1) break;
    }

    const chosen = stationsOnRoute[bestCandidate];
    const distToStation = chosen.milesFromStart - currentMiles;
    const energyUsedPct = (distToStation / model.range) * 100;
    const arrivalCharge = Math.max(currentCharge - energyUsedPct, 2);

    // Determine how much to charge: enough to reach next stop or destination
    const milesAfterStop = totalDistanceMiles - chosen.milesFromStart;
    let targetCharge: number;
    // Find next viable station
    let nextStationDist = milesAfterStop;
    for (let j = bestCandidate + 1; j < stationsOnRoute.length; j++) {
      const d = stationsOnRoute[j].milesFromStart - chosen.milesFromStart;
      if (d > 20) {
        nextStationDist = d;
        break;
      }
    }
    const neededPct = (nextStationDist / (model.range * safetyBuffer)) * 100;
    // Close to destination: charge just enough to arrive comfortably
    if (milesAfterStop < model.range * 0.4) {
      targetCharge = Math.min(Math.max(neededPct + 15, arrivalCharge + 20), 95);
    } else {
      // Far from destination: charge to a solid level (at least 60%)
      // to reduce total stops and take advantage of fast low-SoC charging
      targetCharge = Math.min(Math.max(neededPct + 20, 60, arrivalCharge + 30), 95);
    }

    const chargeMinutes = chargeTimeMinutes(arrivalCharge, targetCharge, model);
    const distanceToNext =
      bestCandidate + 1 < stationsOnRoute.length
        ? stationsOnRoute[bestCandidate + 1].milesFromStart -
          chosen.milesFromStart
        : totalDistanceMiles - chosen.milesFromStart;

    stops.push({
      station: chosen.station,
      arrivalCharge: Math.round(arrivalCharge),
      departureCharge: Math.round(targetCharge),
      chargeTime: Math.round(chargeMinutes),
      distanceFromStart: Math.round(chosen.milesFromStart),
      distanceToNext: Math.round(distanceToNext),
    });

    currentCharge = targetCharge;
    currentMiles = chosen.milesFromStart;
    i = bestCandidate + 1;
  }

  return stops;
}

export function recalculateStops(
  route: LatLng[],
  totalDistanceMiles: number,
  stations: ChargerStation[],
  model: TeslaModel,
  startCharge = 90
): ChargingStop[] {
  if (stations.length === 0) return [];

  const cumDist = cumulativeDistances(route);
  const routeTotalFromCoords = cumDist[cumDist.length - 1];
  const scaleFactor =
    routeTotalFromCoords > 0 ? totalDistanceMiles / routeTotalFromCoords : 1;
  const safetyBuffer = 0.85;

  // Compute each station's position along the route and sort
  const positioned = stations
    .map((station) => {
      const { routeIndex } = findClosestPointOnRoute(station.location, route);
      const milesFromStart = cumDist[routeIndex] * scaleFactor;
      return { station, milesFromStart };
    })
    .sort((a, b) => a.milesFromStart - b.milesFromStart);

  const stops: ChargingStop[] = [];
  let currentCharge = startCharge;
  let currentMiles = 0;

  for (let i = 0; i < positioned.length; i++) {
    const chosen = positioned[i];
    const distToStation = chosen.milesFromStart - currentMiles;
    const energyUsedPct = (distToStation / model.range) * 100;
    const arrivalCharge = Math.max(currentCharge - energyUsedPct, 2);

    // Determine target charge (same logic as planChargingStops)
    const milesAfterStop = totalDistanceMiles - chosen.milesFromStart;
    let nextStationDist = milesAfterStop;
    for (let j = i + 1; j < positioned.length; j++) {
      const d = positioned[j].milesFromStart - chosen.milesFromStart;
      if (d > 20) {
        nextStationDist = d;
        break;
      }
    }
    const neededPct = (nextStationDist / (model.range * safetyBuffer)) * 100;
    let targetCharge: number;
    if (milesAfterStop < model.range * 0.4) {
      targetCharge = Math.min(Math.max(neededPct + 15, arrivalCharge + 20), 95);
    } else {
      targetCharge = Math.min(Math.max(neededPct + 20, 60, arrivalCharge + 30), 95);
    }

    const chargeMinutes = chargeTimeMinutes(arrivalCharge, targetCharge, model);
    const distanceToNext =
      i + 1 < positioned.length
        ? positioned[i + 1].milesFromStart - chosen.milesFromStart
        : totalDistanceMiles - chosen.milesFromStart;

    stops.push({
      station: chosen.station,
      arrivalCharge: Math.round(arrivalCharge),
      departureCharge: Math.round(targetCharge),
      chargeTime: Math.round(chargeMinutes),
      distanceFromStart: Math.round(chosen.milesFromStart),
      distanceToNext: Math.round(distanceToNext),
    });

    currentCharge = targetCharge;
    currentMiles = chosen.milesFromStart;
  }

  return stops;
}

export function calculateArrivalCharge(
  totalDistanceMiles: number,
  stops: ChargingStop[],
  model: TeslaModel,
  startCharge: number
): number {
  if (stops.length === 0) {
    const usedPct = (totalDistanceMiles / model.range) * 100;
    return Math.max(Math.round(startCharge - usedPct), 0);
  }
  const lastStop = stops[stops.length - 1];
  const milesAfterLastStop = totalDistanceMiles - lastStop.distanceFromStart;
  const usedPct = (milesAfterLastStop / model.range) * 100;
  return Math.max(Math.round(lastStop.departureCharge - usedPct), 0);
}
