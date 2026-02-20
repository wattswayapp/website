"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { GeocodeSuggestion, FavoriteLocation } from "@/lib/types";
import { MapPin, X, Star, LocateFixed, Loader2, Settings, ExternalLink } from "lucide-react";
import { getFavoriteLocations, toggleFavoriteLocation, isFavoriteLocation } from "@/lib/favorites";

interface LocationInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string, suggestion?: GeocodeSuggestion) => void;
  icon: "origin" | "destination";
}

export default function LocationInput({
  label,
  placeholder,
  value,
  onChange,
  icon,
}: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locatingCurrent, setLocatingCurrent] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [favLocKeys, setFavLocKeys] = useState<Set<string>>(new Set());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const locKey = (lat: number, lng: number) => `${lat},${lng}`;

  const refreshFavorites = useCallback(() => {
    const favs = getFavoriteLocations();
    setFavoriteLocations(favs);
    setFavLocKeys(new Set(favs.map((f) => locKey(f.lat, f.lng))));
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(Array.isArray(data) ? data : []);
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setLocationError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fetchSuggestions(val), 400);
    setShowSuggestions(true);
  };

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    onChange(suggestion.displayName, suggestion);
    setLocationError(null);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleClear = () => {
    onChange("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }
    if (window.isSecureContext === false) {
      setLocationError("Location requires a secure (HTTPS) connection");
      return;
    }
    setLocatingCurrent(true);
    setLocationError(null);
    setShowSuggestions(false);
    try {
      // Prefer browser GPS, only fall back to IP if GPS fails
      const geoPromise = (highAccuracy: boolean, timeout: number) =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout,
            maximumAge: 300000, // 5 min cache
          });
        });

      const ipFallback = () =>
        fetch("/api/geolocation")
          .then((r) => r.json())
          .then((data) => {
            if (!data.lat || !data.lng) throw new Error("no IP location");
            return { coords: { latitude: data.lat, longitude: data.lng } } as GeolocationPosition;
          });

      // Race low + high accuracy GPS first; IP only if both fail
      const position = await Promise.any([
        geoPromise(false, 3000),  // low accuracy — fast
        geoPromise(true, 3000),   // high accuracy — may be fast if cached
      ]).catch(() => ipFallback());
      const { latitude, longitude } = position.coords;
      const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
      const data = await res.json();
      if (data.displayName) {
        onChange(data.displayName, { displayName: data.displayName, lat: data.lat, lng: data.lng });
        setSuggestions([]);
      } else {
        setLocationError("Could not determine your address");
      }
    } catch (err: unknown) {
      // Promise.any rejects with AggregateError when all promises fail
      const errors = err instanceof AggregateError ? err.errors : [err];
      const geoErrors = errors.filter(
        (e): e is GeolocationPositionError => typeof (e as GeolocationPositionError)?.code === "number"
      );
      if (geoErrors.some((e) => e.code === 1)) {
        setLocationError("denied");
      } else if (geoErrors.length > 0 && geoErrors.every((e) => e.code === 3)) {
        setLocationError("Location request timed out. Try again.");
      } else {
        setLocationError("Could not get your location. Try again.");
      }
    }
    setLocatingCurrent(false);
  }, [onChange]);

  useEffect(() => {
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-[11px] md:text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative flex items-center">
        <div
          className={`absolute left-3 w-3 h-3 rounded-full border-2 ${
            icon === "origin"
              ? "border-green-400 bg-green-400/20 dot-pulse-green"
              : "border-red-400 bg-red-400/20 dot-pulse-red"
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => (suggestions.length > 0 || favoriteLocations.length > 0 || icon === "origin") && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full bg-elevated/80 border border-edge/50 rounded-xl py-3 md:py-3.5 pl-10 pr-10 text-sm md:text-base text-foreground placeholder:text-faint-fg focus:outline-none focus:border-[#e31937]/50 focus:ring-1 focus:ring-[#e31937]/20 transition-all"
        />
        {value ? (
          <button
            onClick={handleClear}
            className="absolute right-2 p-1.5 text-faint-fg hover:text-secondary-fg transition-colors"
          >
            <X size={14} />
          </button>
        ) : icon === "origin" && (
          <button
            onClick={handleUseCurrentLocation}
            disabled={locatingCurrent}
            className="absolute right-1.5 p-2 text-faint-fg hover:text-[#e31937] active:text-[#e31937] transition-colors disabled:opacity-50"
            title="Use current location"
          >
            {locatingCurrent ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LocateFixed size={16} />
            )}
          </button>
        )}
      </div>
      {locationError && locationError !== "denied" && (
        <p className="mt-1.5 text-[11px] md:text-xs text-red-400 px-1">{locationError}</p>
      )}
      {locationError === "denied" && (
        <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Settings size={14} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs md:text-sm font-medium text-red-400">Location access denied</p>
              <p className="text-[11px] md:text-xs text-red-400/80 mt-1">
                To use your current location, enable location access:
              </p>
            </div>
          </div>
          {/iPad|iPhone|iPod/.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? (
            <div className="space-y-1.5 pl-[22px]">
              <p className="text-[11px] md:text-xs text-secondary-fg">
                1. Open <span className="font-semibold">Settings</span> on your iPhone
              </p>
              <p className="text-[11px] md:text-xs text-secondary-fg">
                2. Scroll down to <span className="font-semibold">Safari</span>
              </p>
              <p className="text-[11px] md:text-xs text-secondary-fg">
                3. Tap <span className="font-semibold">Location</span> and select <span className="font-semibold">Allow</span> or <span className="font-semibold">Ask</span>
              </p>
              <p className="text-[11px] md:text-xs text-secondary-fg">
                4. Also check <span className="font-semibold">Settings &gt; Privacy &gt; Location Services</span> is on
              </p>
              <p className="text-[11px] md:text-xs text-faint-fg mt-2">
                Then come back here and tap the location button again.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 pl-[22px]">
              <p className="text-[11px] md:text-xs text-secondary-fg">
                1. Tap the <span className="font-semibold">lock icon</span> or <span className="font-semibold">site settings</span> in your browser&apos;s address bar
              </p>
              <p className="text-[11px] md:text-xs text-secondary-fg">
                2. Set <span className="font-semibold">Location</span> to <span className="font-semibold">Allow</span>
              </p>
              <p className="text-[11px] md:text-xs text-secondary-fg">
                3. Reload the page and try again
              </p>
            </div>
          )}
          <button
            onClick={() => setLocationError(null)}
            className="text-[11px] md:text-xs text-faint-fg hover:text-secondary-fg transition-colors pl-[22px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {showSuggestions && (suggestions.length > 0 || favoriteLocations.length > 0 || icon === "origin") && (
        <div className="absolute z-50 top-full mt-1 w-full bg-elevated border border-edge rounded-xl shadow-2xl overflow-hidden max-h-[60dvh] md:max-h-48 overflow-y-auto overscroll-contain">
          {loading && (
            <div className="px-4 py-2 text-xs text-faint-fg">Searching...</div>
          )}
          {icon === "origin" && suggestions.length === 0 && (
            <button
              onClick={handleUseCurrentLocation}
              disabled={locatingCurrent}
              className="w-full px-4 py-3.5 md:py-3 text-left hover:bg-accent-surface/50 active:bg-accent-surface transition-colors flex items-center gap-2.5 border-b border-edge/30 disabled:opacity-50"
            >
              {locatingCurrent ? (
                <Loader2 size={14} className="text-[#e31937] shrink-0 animate-spin" />
              ) : (
                <LocateFixed size={14} className="text-[#e31937] shrink-0" />
              )}
              <span className="text-sm text-secondary-fg">
                {locatingCurrent ? "Locating..." : "Use current location"}
              </span>
            </button>
          )}
          {favoriteLocations.length > 0 && suggestions.length === 0 && (
            <>
              <div className="px-4 pt-2.5 pb-1.5 text-[10px] md:text-xs font-semibold text-muted-fg uppercase tracking-wider">
                Favorites
              </div>
              {favoriteLocations.map((fav) => (
                <button
                  key={fav.id}
                  onClick={() => handleSelect({ displayName: fav.displayName, lat: fav.lat, lng: fav.lng })}
                  className="w-full px-4 py-3.5 md:py-3 text-left hover:bg-accent-surface/50 active:bg-accent-surface transition-colors flex items-center gap-2.5 border-b border-edge/30 last:border-0"
                >
                  <Star size={14} className="text-yellow-400 fill-yellow-400 shrink-0" />
                  <span className="text-sm md:text-base text-secondary-fg line-clamp-2 flex-1 min-w-0">
                    {fav.displayName}
                  </span>
                </button>
              ))}
            </>
          )}
          {suggestions.map((s, i) => {
            const isFav = favLocKeys.has(locKey(s.lat, s.lng));
            return (
              <div
                key={i}
                className="flex items-center border-b border-edge/30 last:border-0 hover:bg-accent-surface/50 active:bg-accent-surface transition-colors"
              >
                <button
                  onClick={() => handleSelect(s)}
                  className="flex-1 px-4 py-3.5 md:py-3 text-left flex items-start gap-2.5 min-w-0"
                >
                  <MapPin
                    size={14}
                    className="text-faint-fg mt-0.5 shrink-0"
                  />
                  <span className="text-sm md:text-base text-secondary-fg line-clamp-2">
                    {s.displayName}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteLocation(s.displayName, s.lat, s.lng);
                    refreshFavorites();
                  }}
                  className="pr-3 pl-1 py-3 shrink-0"
                  title={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star
                    size={14}
                    className={isFav ? "text-yellow-400 fill-yellow-400" : "text-faint-fg hover:text-yellow-400 transition-colors"}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
