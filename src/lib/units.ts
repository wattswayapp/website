export type UnitSystem = "imperial" | "metric";

const MI_TO_KM = 1.60934;

export function convertDistance(miles: number, units: UnitSystem): number {
  return units === "metric" ? miles * MI_TO_KM : miles;
}

export function formatDistance(miles: number, units: UnitSystem): string {
  const val = convertDistance(miles, units);
  return `${Math.round(val)} ${units === "metric" ? "km" : "mi"}`;
}

export function distanceLabel(units: UnitSystem): string {
  return units === "metric" ? "km" : "mi";
}

export function milesToKm(miles: number): number {
  return miles * MI_TO_KM;
}

export function kmToMiles(km: number): number {
  return km / MI_TO_KM;
}
