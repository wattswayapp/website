import { FavoriteLocation, FavoriteCharger, ChargerStation } from "./types";

const STORAGE_KEY_LOCATIONS = "ttp-favorite-locations";
const STORAGE_KEY_CHARGERS = "ttp-favorite-chargers";
const MAX_FAVORITES = 50;

// --- Favorite Locations ---

export function getFavoriteLocations(): FavoriteLocation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCATIONS);
    if (!raw) return [];
    const items = JSON.parse(raw) as FavoriteLocation[];
    return items.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function isFavoriteLocation(lat: number, lng: number): boolean {
  const favorites = getFavoriteLocations();
  return favorites.some((f) => f.lat === lat && f.lng === lng);
}

export function toggleFavoriteLocation(
  displayName: string,
  lat: number,
  lng: number
): boolean {
  try {
    const existing = getFavoriteLocations();
    const idx = existing.findIndex((f) => f.lat === lat && f.lng === lng);

    if (idx !== -1) {
      existing.splice(idx, 1);
      localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(existing));
      return false;
    }

    const entry: FavoriteLocation = {
      id: crypto.randomUUID(),
      displayName,
      lat,
      lng,
      savedAt: Date.now(),
    };
    const updated = [entry, ...existing].slice(0, MAX_FAVORITES);
    localStorage.setItem(STORAGE_KEY_LOCATIONS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

// --- Favorite Chargers ---

export function getFavoriteChargers(): FavoriteCharger[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHARGERS);
    if (!raw) return [];
    const items = JSON.parse(raw) as FavoriteCharger[];
    return items.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function isFavoriteCharger(stationId: string): boolean {
  const favorites = getFavoriteChargers();
  return favorites.some((f) => f.id === stationId);
}

export function toggleFavoriteCharger(station: ChargerStation): boolean {
  try {
    const existing = getFavoriteChargers();
    const idx = existing.findIndex((f) => f.id === station.id);

    if (idx !== -1) {
      existing.splice(idx, 1);
      localStorage.setItem(STORAGE_KEY_CHARGERS, JSON.stringify(existing));
      return false;
    }

    const entry: FavoriteCharger = {
      id: station.id,
      station,
      savedAt: Date.now(),
    };
    const updated = [entry, ...existing].slice(0, MAX_FAVORITES);
    localStorage.setItem(STORAGE_KEY_CHARGERS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}
