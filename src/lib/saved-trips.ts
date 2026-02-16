import { SavedTrip, TripRoute } from "./types";

const STORAGE_KEY = "ttp-saved-trips";
const MAX_SAVED = 20;

export function getSavedTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const trips = JSON.parse(raw) as SavedTrip[];
    return trips.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveTrip(
  trip: TripRoute,
  modelId: string,
  modelName: string,
  startCharge: number
): SavedTrip | null {
  try {
    const stripped: TripRoute = { ...trip, polyline: [] };
    const saved: SavedTrip = {
      id: crypto.randomUUID(),
      label: `${trip.origin} → ${trip.destination}`,
      savedAt: Date.now(),
      modelId,
      modelName,
      startCharge,
      trip: stripped,
    };

    const existing = getSavedTrips();
    const updated = [saved, ...existing].slice(0, MAX_SAVED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return saved;
  } catch {
    return null;
  }
}

export function deleteSavedTrip(id: string): boolean {
  try {
    const existing = getSavedTrips();
    const filtered = existing.filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}
