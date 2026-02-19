"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import LocationInput from "./LocationInput";
import VehicleSelector from "./VehicleSelector";
import UnitToggle from "./UnitToggle";
import TripSummary from "./TripSummary";
import AskAI from "./AskAI";
import { TESLA_MODELS } from "@/lib/tesla-models";
import { UnitSystem } from "@/lib/units";
import {
  TeslaModel,
  LatLng,
  TripRoute,
  GeocodeSuggestion,
  ChargingStop,
  ChargerStation,
  TrafficCongestion,
} from "@/lib/types";
import {
  planChargingStops,
  calculateArrivalCharge,
  recalculateStops,
} from "@/lib/trip-calculator";
import { ChargerFilters } from "./TripMap";
import {
  Zap,
  ArrowUpDown,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  Pencil,
  Plus,
  Settings2,
  Activity,
  Bookmark,
  Eye,
  EyeOff,
  Check,
  ArrowLeft,
  Heart,
  GitBranch,
  Globe,
  MapPin,
} from "lucide-react";
import { SavedTrip } from "@/lib/types";
import { saveTrip as saveTripToStorage } from "@/lib/saved-trips";
import SavedTripsPanel from "./SavedTripsPanel";

export type Theme = "dark" | "light";
type WizardStep = "origin" | "destination" | "configure" | "results";

interface TripPlannerProps {
  initialModel?: TeslaModel;
  initialStartCharge?: number;
}

// Dynamic import for map (needs browser APIs)
const TripMap = dynamic(() => import("./TripMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-surface flex items-center justify-center">
      <Loader2 className="animate-spin text-dim-fg" size={32} />
    </div>
  ),
});

const LOADING_MESSAGES = [
  "Planning your route...",
  "Finding Superchargers nearby...",
  "Calculating charge times...",
  "Optimizing your stops...",
  "Checking battery math...",
  "Almost there, hang tight...",
  "WattsWay is working for you...",
  "Crunching the numbers...",
  "Electrons are aligning...",
  "Making sure you won't get stranded...",
];

export default function TripPlanner({
  initialModel,
  initialStartCharge,
}: TripPlannerProps = {}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState<LatLng | null>(null);
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [selectedModel, setSelectedModel] = useState<TeslaModel>(
    initialModel ?? TESLA_MODELS[1] // Model 3 Long Range default
  );
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [theme, setTheme] = useState<Theme>(() => {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6 ? "dark" : "light";
  });
  const [trip, setTrip] = useState<TripRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<LatLng[] | null>(null);
  const [chargingStops, setChargingStops] = useState<ChargingStop[]>([]);
  const [nearbyChargers, setNearbyChargers] = useState<ChargerStation[]>([]);
  const [chargerFilters, setChargerFilters] = useState<ChargerFilters>({
    showSuperchargers: true,
    showOtherChargers: false,
    hideUnusedChargers: false,
  });
  const [isMobile, setIsMobile] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>("origin");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ center: LatLng; zoom: number } | null>(null);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(true);
  const [mobileSheetHidden, setMobileSheetHidden] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const [trafficCongestion, setTrafficCongestion] = useState<TrafficCongestion | null>(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [savedTripsOpen, setSavedTripsOpen] = useState(false);
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [highlightedChargerId, setHighlightedChargerId] = useState<string | null>(null);
  const [swappingStopIndex, setSwappingStopIndex] = useState<number | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false);
  const touchStartY = useRef<number | null>(null);

  // Toggle theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme]);

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-expand sheet on wizard step transitions
  useEffect(() => {
    if (isMobile) {
      setMobileSheetExpanded(true);
      setMobileSheetHidden(false);
    }
  }, [wizardStep, isMobile]);

  // Persist vehicle selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "ttp-onboarding",
        JSON.stringify({
          completed: true,
          modelId: selectedModel.id,
          startCharge: initialStartCharge ?? 90,
        })
      );
    } catch {
      // localStorage unavailable
    }
  }, [selectedModel, initialStartCharge]);

  // Cycle loading messages while planning
  useEffect(() => {
    if (!loading) {
      setLoadingMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const handleSaveTrip = () => {
    if (!trip) return;
    const result = saveTripToStorage(
      trip,
      selectedModel.id,
      selectedModel.name,
      initialStartCharge ?? 90
    );
    if (result) {
      setSaveConfirm(true);
      setTimeout(() => setSaveConfirm(false), 2000);
    }
  };

  const handleLoadSavedTrip = (saved: SavedTrip) => {
    setOrigin(saved.trip.origin);
    setDestination(saved.trip.destination);
    setOriginCoords(saved.trip.originCoords);
    setDestCoords(saved.trip.destinationCoords);
    setTrip(saved.trip);
    setChargingStops(saved.trip.chargingStops);
    setRoutePolyline(null);
    setNearbyChargers([]);
    setError(null);
    setFocusPoint(null);
    setTrafficCongestion(null);
    setWizardStep("results");
    setMobileSheetExpanded(true);
    setMobileSheetHidden(false);

    // Re-fetch route polyline in background (stripped from localStorage to save space)
    const { originCoords: oc, destinationCoords: dc } = saved.trip;
    fetch(
      `/api/route?originLat=${oc.lat}&originLng=${oc.lng}&destLat=${dc.lat}&destLng=${dc.lng}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.polyline) {
          setRoutePolyline(data.polyline);
          fetchChargersAlongRoute(data.polyline).then(setNearbyChargers);
        }
      })
      .catch(() => {});
  };

  const handleSwapStop = useCallback(
    (index: number, newStation: ChargerStation) => {
      if (!trip || !routePolyline) return;
      const newStations = chargingStops.map((s, i) =>
        i === index ? newStation : s.station
      );
      const startChargeValue = initialStartCharge ?? 90;
      const newStops = recalculateStops(
        routePolyline,
        trip.distance,
        newStations,
        selectedModel,
        startChargeValue
      );
      const totalChargeTime = newStops.reduce((sum, s) => sum + s.chargeTime, 0);
      const arrivalCharge = calculateArrivalCharge(
        trip.distance,
        newStops,
        selectedModel,
        startChargeValue
      );
      setChargingStops(newStops);
      setTrip({
        ...trip,
        chargingStops: newStops,
        arrivalCharge,
        totalChargeTime,
        totalTripTime: trip.duration + totalChargeTime,
      });
    },
    [trip, routePolyline, chargingStops, selectedModel, initialStartCharge]
  );

  const handleMapSwapCharger = useCallback(
    (station: ChargerStation) => {
      if (swappingStopIndex == null) return;
      handleSwapStop(swappingStopIndex, station);
      setSwappingStopIndex(null);
    },
    [swappingStopIndex, handleSwapStop]
  );

  const resetTrip = () => {
    setOrigin("");
    setDestination("");
    setOriginCoords(null);
    setDestCoords(null);
    setTrip(null);
    setError(null);
    setRoutePolyline(null);
    setChargingStops([]);
    setNearbyChargers([]);
    setFocusPoint(null);
    setTrafficCongestion(null);
    setTrafficLoading(false);
    setWizardStep("origin");
  };

  const handleOriginChange = (value: string, suggestion?: GeocodeSuggestion) => {
    setOrigin(value);
    if (suggestion) {
      setOriginCoords({ lat: suggestion.lat, lng: suggestion.lng });
      setFocusPoint({ center: { lat: suggestion.lat, lng: suggestion.lng }, zoom: 10 });
      setWizardStep("destination");
    }
  };

  const handleDestChange = (value: string, suggestion?: GeocodeSuggestion) => {
    setDestination(value);
    if (suggestion) {
      setDestCoords({ lat: suggestion.lat, lng: suggestion.lng });
      setWizardStep("configure");
    }
  };

  const swapLocations = () => {
    const tmpOrigin = origin;
    const tmpCoords = originCoords;
    setOrigin(destination);
    setOriginCoords(destCoords);
    setDestination(tmpOrigin);
    setDestCoords(tmpCoords);
  };

  const fetchChargersAlongRoute = async (
    polyline: LatLng[]
  ): Promise<ChargerStation[]> => {
    let south = Infinity, north = -Infinity;
    let west = Infinity, east = -Infinity;
    for (const p of polyline) {
      if (p.lat < south) south = p.lat;
      if (p.lat > north) north = p.lat;
      if (p.lng < west) west = p.lng;
      if (p.lng > east) east = p.lng;
    }
    const pad = 0.45;
    south -= pad;
    north += pad;
    west -= pad;
    east += pad;

    try {
      const res = await fetch("/api/chargers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ south, west, north, east }),
      });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const planTrip = useCallback(async () => {
    if (!originCoords || !destCoords) {
      setError("Please select both origin and destination from suggestions");
      return;
    }

    setLoading(true);
    setError(null);
    setTrip(null);
    setRoutePolyline(null);
    setChargingStops([]);
    setNearbyChargers([]);

    try {
      // Compute bbox from origin/dest coords so we can fetch chargers in parallel with the route
      const pad = 0.45;
      const bboxSouth = Math.min(originCoords.lat, destCoords.lat) - pad;
      const bboxNorth = Math.max(originCoords.lat, destCoords.lat) + pad;
      const bboxWest = Math.min(originCoords.lng, destCoords.lng) - pad;
      const bboxEast = Math.max(originCoords.lng, destCoords.lng) + pad;

      const [routeData, chargers] = await Promise.all([
        fetch(
          `/api/route?originLat=${originCoords.lat}&originLng=${originCoords.lng}&destLat=${destCoords.lat}&destLng=${destCoords.lng}`
        ).then((res) => res.json()),
        fetch("/api/chargers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ south: bboxSouth, west: bboxWest, north: bboxNorth, east: bboxEast }),
        })
          .then((res) => res.json())
          .then((data) => (Array.isArray(data) ? data : []) as ChargerStation[])
          .catch(() => [] as ChargerStation[]),
      ]);

      if (routeData.error) {
        throw new Error(routeData.error);
      }

      setRoutePolyline(routeData.polyline);
      setNearbyChargers(chargers);

      const chargersForPlanning = chargers.filter((c) => {
        const isTesla = c.network?.toLowerCase().includes("tesla");
        if (isTesla) return chargerFilters.showSuperchargers;
        return chargerFilters.showOtherChargers;
      });

      const startChargeValue = initialStartCharge ?? 90;
      const stops = planChargingStops(
        routeData.polyline,
        routeData.distance,
        chargersForPlanning,
        selectedModel,
        startChargeValue
      );

      setChargingStops(stops);

      const totalChargeTime = stops.reduce((sum, s) => sum + s.chargeTime, 0);
      const arrivalCharge = calculateArrivalCharge(
        routeData.distance,
        stops,
        selectedModel,
        startChargeValue
      );

      const tripResult: TripRoute = {
        origin: origin.split(",")[0],
        destination: destination.split(",")[0],
        originCoords,
        destinationCoords: destCoords,
        distance: routeData.distance,
        duration: routeData.duration,
        polyline: routeData.polyline,
        chargingStops: stops,
        arrivalCharge,
        totalChargeTime,
        totalTripTime: routeData.duration + totalChargeTime,
      };

      setTrip(tripResult);
      setMobileSheetExpanded(true);
      setMobileSheetHidden(false);
      setWizardStep("results");

      // Non-blocking traffic fetch
      if (process.env.NEXT_PUBLIC_TOMTOM_API_KEY) {
        setTrafficLoading(true);
        setTrafficCongestion(null);
        fetch("/api/traffic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ polyline: routeData.polyline }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && !data.error) setTrafficCongestion(data);
          })
          .catch(() => {})
          .finally(() => setTrafficLoading(false));
      }
    } catch (err: any) {
      setError(err.message || "Failed to plan trip. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [originCoords, destCoords, origin, destination, selectedModel, chargerFilters, initialStartCharge]);

  // Compact origin chip — clickable to go back to origin step
  const originChip = (
    <button
      onClick={() => setWizardStep("origin")}
      className="flex items-center gap-2.5 bg-elevated/80 border border-edge/50 rounded-xl px-3 md:px-4 py-3 md:py-3.5 text-left group hover:border-[#e31937]/40 transition-colors w-full"
    >
      <div className="w-3 h-3 rounded-full border-2 border-green-400 bg-green-400/20 shrink-0 dot-pulse-green" />
      <span className="text-sm md:text-base text-secondary-fg truncate flex-1">
        {origin.split(",")[0]}
      </span>
      <Pencil size={12} className="text-dim-fg group-hover:text-muted-fg transition-colors shrink-0" />
    </button>
  );

  // Compact origin -> dest summary with vertical dots connector
  const routeSummary = (
    <div className="flex items-center gap-3">
      <div className="flex flex-col flex-1 min-w-0">
        {/* Origin row */}
        <div className="flex items-center gap-2.5 py-1.5">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-green-400 bg-green-400/20 shrink-0 dot-pulse-green" />
          <button
            onClick={() => setWizardStep("origin")}
            className="text-sm text-secondary-fg truncate text-left hover:text-foreground transition-colors"
          >
            {origin.split(",")[0]}
          </button>
        </div>
        {/* Connector line */}
        <div className="ml-[4.5px] h-2 w-px bg-edge/60" />
        {/* Destination row */}
        <div className="flex items-center gap-2.5 py-1.5">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-red-400 bg-red-400/20 shrink-0 dot-pulse-red" />
          <button
            onClick={() => setWizardStep("destination")}
            className="text-sm text-secondary-fg truncate text-left hover:text-foreground transition-colors"
          >
            {destination.split(",")[0]}
          </button>
        </div>
      </div>
      <button
        onClick={swapLocations}
        className="w-7 h-7 rounded-full bg-elevated border border-edge/50 flex items-center justify-center hover:bg-accent-surface transition-colors shrink-0"
        title="Swap"
      >
        <ArrowUpDown size={12} className="text-muted-fg" />
      </button>
    </div>
  );

  // Render wizard step content
  const renderStepContent = () => {
    switch (wizardStep) {
      case "origin":
        return (
          <div className="wizard-step-enter" key="origin">
            <button
              onClick={() => setSavedTripsOpen(true)}
              className="flex items-center gap-1.5 text-[11px] md:text-xs text-muted-fg hover:text-foreground transition-colors mb-3"
            >
              <Bookmark size={12} />
              Saved trips
            </button>
            <p className="text-sm md:text-base font-medium text-foreground mb-3">Where are you starting from?</p>
            <LocationInput
              label="Origin"
              placeholder="Enter starting location"
              value={origin}
              onChange={handleOriginChange}
              icon="origin"
            />
            {originCoords && origin && (
              <button
                onClick={() => setWizardStep("destination")}
                className="w-full mt-3 py-2.5 md:py-3 bg-[#e31937] hover:bg-[#ff2d4b] text-white text-sm md:text-base font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        );

      case "destination":
        return (
          <div className="wizard-step-enter" key="destination">
            <p className="text-sm md:text-base font-medium text-foreground mb-3">Where are you going?</p>
            <div className="space-y-3">
              {originChip}
              <div className="flex justify-center -my-1 relative z-10">
                <button
                  onClick={swapLocations}
                  className="w-7 h-7 rounded-full bg-elevated border border-edge flex items-center justify-center hover:bg-accent-surface transition-colors"
                >
                  <ArrowUpDown size={12} className="text-muted-fg" />
                </button>
              </div>
              <LocationInput
                label="Destination"
                placeholder="Enter destination"
                value={destination}
                onChange={handleDestChange}
                icon="destination"
              />
              {destCoords && destination && (
                <button
                  onClick={() => setWizardStep("configure")}
                  className="w-full py-2.5 md:py-3 bg-[#e31937] hover:bg-[#ff2d4b] text-white text-sm md:text-base font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        );

      case "configure":
        return (
          <div className="wizard-step-enter" key="configure">
            <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3 md:mb-4">Route settings</h2>

            {/* Route summary */}
            <div className="mb-4">
              {routeSummary}
            </div>

            {/* Vehicle */}
            <div className="mb-4">
              <VehicleSelector
                selected={selectedModel}
                onSelect={setSelectedModel}
                units={units}
              />
            </div>

            {/* Collapsible settings */}
            <details
              open={settingsOpen}
              onToggle={(e) => setSettingsOpen((e.target as HTMLDetailsElement).open)}
              className="mb-4"
            >
              <summary className="flex items-center gap-2 cursor-pointer text-[11px] md:text-xs font-medium text-muted-fg uppercase tracking-wider mb-2 select-none list-none [&::-webkit-details-marker]:hidden">
                <Settings2 size={12} />
                More settings
                <ChevronRight size={12} className={`transition-transform ${settingsOpen ? "rotate-90" : ""}`} />
              </summary>
              <div className="space-y-3 pt-1">
                <UnitToggle units={units} onChange={setUnits} />

                {/* Charger type preference */}
                <div>
                  <label className="block text-[11px] font-medium text-muted-fg uppercase tracking-wider mb-1.5">
                    Charger Types
                  </label>
                  <div className="bg-elevated/80 border border-edge/50 rounded-xl p-3 space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#e31937]" />
                        <span className="text-xs md:text-sm text-secondary-fg">Tesla Superchargers</span>
                      </div>
                      <button
                        onClick={() =>
                          setChargerFilters((f) => ({
                            ...f,
                            showSuperchargers: !f.showSuperchargers,
                          }))
                        }
                        className={`w-9 h-[22px] rounded-full relative transition-colors ${
                          chargerFilters.showSuperchargers
                            ? "bg-[#e31937]"
                            : "bg-dim-fg"
                        }`}
                      >
                        <div
                          className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            chargerFilters.showSuperchargers
                              ? "translate-x-[16px]"
                              : "translate-x-[3px]"
                          }`}
                        />
                      </button>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                        <span className="text-xs md:text-sm text-secondary-fg">Other DC fast chargers</span>
                      </div>
                      <button
                        onClick={() =>
                          setChargerFilters((f) => ({
                            ...f,
                            showOtherChargers: !f.showOtherChargers,
                          }))
                        }
                        className={`w-9 h-[22px] rounded-full relative transition-colors ${
                          chargerFilters.showOtherChargers
                            ? "bg-[#6366f1]"
                            : "bg-dim-fg"
                        }`}
                      >
                        <div
                          className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                            chargerFilters.showOtherChargers
                              ? "translate-x-[16px]"
                              : "translate-x-[3px]"
                          }`}
                        />
                      </button>
                    </label>
                    <p className="text-[10px] md:text-[11px] text-dim-fg">
                      Controls which chargers appear on the map and are used for route planning
                    </p>
                  </div>
                </div>

                {/* Traffic overlay toggle */}
                {process.env.NEXT_PUBLIC_TOMTOM_API_KEY && (
                  <div>
                    <label className="block text-[11px] md:text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5">
                      Traffic
                    </label>
                    <div className="bg-elevated/80 border border-edge/50 rounded-xl p-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                          <span className="text-xs md:text-sm text-secondary-fg">Live traffic overlay</span>
                        </div>
                        <button
                          onClick={() => setShowTraffic((v) => !v)}
                          className={`w-9 h-[22px] rounded-full relative transition-colors ${
                            showTraffic ? "bg-orange-500" : "bg-dim-fg"
                          }`}
                        >
                          <div
                            className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                              showTraffic ? "translate-x-[16px]" : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                      </label>
                      <p className="text-[10px] md:text-[11px] text-dim-fg mt-1.5">
                        Shows real-time congestion from TomTom
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </details>

            {/* Plan button */}
            <button
              onClick={planTrip}
              disabled={loading || !origin || !destination}
              className="w-full py-3.5 md:py-4 bg-[#e31937] hover:bg-[#ff2d4b] active:bg-[#c41530] disabled:bg-edge disabled:text-faint-fg text-white text-sm md:text-base font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {LOADING_MESSAGES[loadingMsgIdx]}
                </>
              ) : (
                <>
                  <Zap size={18} />
                  Plan my trip
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        );

      case "results":
        return (
          <div className="wizard-step-enter" key="results">
            {/* Compact route header */}
            {trip && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-sm md:text-base">
                  <span className="font-medium text-foreground truncate">{trip.origin}</span>
                  <ChevronRight size={14} className="text-dim-fg shrink-0" />
                  <span className="font-medium text-foreground truncate">{trip.destination}</span>
                </div>
              </div>
            )}

            <TripSummary trip={trip} loading={loading} units={units} startCharge={initialStartCharge ?? 90} trafficCongestion={trafficCongestion} trafficLoading={trafficLoading} nearbyChargers={nearbyChargers} onSwapStop={handleSwapStop} onHighlightCharger={setHighlightedChargerId} onSwappingStopChange={setSwappingStopIndex} />

            {trip && (
              <AskAI trip={trip} selectedModel={selectedModel} startCharge={initialStartCharge ?? 90} />
            )}

            {/* Action buttons */}
            {trip && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setWizardStep("configure")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 md:py-3 bg-elevated/80 border border-edge/50 rounded-xl text-xs md:text-sm font-medium text-secondary-fg hover:bg-accent-surface/80 transition-all"
                >
                  <Pencil size={13} />
                  Edit trip
                </button>
                <button
                  onClick={handleSaveTrip}
                  disabled={saveConfirm}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 md:py-3 border rounded-xl text-xs md:text-sm font-medium transition-all ${
                    saveConfirm
                      ? "bg-green-500/15 border-green-500/30 text-green-400"
                      : "bg-elevated/80 border-edge/50 text-secondary-fg hover:bg-accent-surface/80"
                  }`}
                >
                  {saveConfirm ? (
                    <>
                      <Check size={13} />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Bookmark size={13} />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={resetTrip}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 md:py-3 bg-elevated/80 border border-edge/50 rounded-xl text-xs md:text-sm font-medium text-secondary-fg hover:bg-accent-surface/80 transition-all"
                >
                  <Plus size={13} />
                  New trip
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-edge/30 text-center">
              <p className="text-[10px] md:text-[11px] text-dim-fg">
                v{process.env.NEXT_PUBLIC_APP_VERSION} · Powered by OpenStreetMap, OSRM &amp; supercharge.info
              </p>
            </div>
          </div>
        );
    }
  };


  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* Desktop Top Navigation */}
      <nav className="hidden md:flex items-center justify-between h-14 px-6 bg-surface/95 border-b border-edge/50 z-20 shrink-0">
        {/* Left: Logo */}
        <a href="/" className="flex items-center gap-2.5">
          <img src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"} alt="WattsWay" className="w-7 h-7 rounded-lg" />
          <div className="flex items-baseline gap-2">
            <span className="wattway-logo text-foreground">WATTSWAY</span>
            <span className="text-[9px] text-dim-fg font-medium tracking-wide uppercase">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          </div>
        </a>

        {/* Right: Utilities */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAbout((v) => !v)}
            className="px-3.5 py-1.5 rounded-xl bg-elevated border border-edge/50 flex items-center gap-2 hover:bg-accent-surface transition-colors"
            title="About WattsWay"
          >
            <span className="text-[13px] font-medium text-muted-fg">About us</span>
          </button>
          <a
            href="https://x.com/WattsWayApp"
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-xl bg-elevated border border-edge/50 flex items-center justify-center hover:bg-accent-surface transition-colors"
            title="Follow WattsWay on X"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-muted-fg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-elevated border border-edge/50 flex items-center justify-center hover:bg-accent-surface transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun size={16} className="text-muted-fg" />
            ) : (
              <Moon size={16} className="text-muted-fg" />
            )}
          </button>
        </div>
      </nav>

      {/* Full-screen map with floating panel */}
      <div className="flex-1 relative min-h-0">
        <TripMap
          route={routePolyline}
          origin={originCoords}
          destination={destCoords}
          chargingStops={chargingStops}
          nearbyChargers={nearbyChargers}
          units={units}
          filters={chargerFilters}
          theme={theme}
          focusPoint={focusPoint}
          showTraffic={showTraffic}
          highlightedChargerId={highlightedChargerId}
          swappingStopIndex={swappingStopIndex}
          onMapSwapCharger={handleMapSwapCharger}
        />

        {/* Mobile floating controls — replaces nav bar */}
        {isMobile && (
          <div className="absolute top-3 left-3 z-[450] flex items-center gap-1.5 safe-area-top">
            <button
              onClick={() => {
                setMobileAboutOpen(true);
                setMobileSheetHidden(false);
                setMobileSheetExpanded(true);
              }}
              className="w-9 h-9 rounded-xl bg-surface/80 backdrop-blur-sm border border-edge/50 flex items-center justify-center active:scale-95 transition-transform"
              title="About WattsWay"
            >
              <img src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"} alt="WattsWay" className="w-5 h-5 rounded" />
            </button>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-surface/80 backdrop-blur-sm border border-edge/50 flex items-center justify-center active:scale-95 transition-transform"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun size={15} className="text-muted-fg" />
              ) : (
                <Moon size={15} className="text-muted-fg" />
              )}
            </button>
            <a
              href="https://x.com/WattsWayApp"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl bg-surface/80 backdrop-blur-sm border border-edge/50 flex items-center justify-center active:scale-95 transition-transform"
              title="Follow WattsWay on X"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-muted-fg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        )}

        {/* Map legend — top-right to avoid floating panel overlap */}
        {nearbyChargers.length > 0 && (
          <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-surface/90 border border-edge/50 rounded-xl px-2.5 py-1.5 md:px-3 md:py-2 backdrop-blur-sm z-[400]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#e31937] border-2 border-white" />
                <span className="text-[9px] md:text-[10px] text-secondary-fg">Planned stop</span>
              </div>
              {chargerFilters.showSuperchargers && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-[#e31937] opacity-60 border border-white" />
                  <span className="text-[9px] md:text-[10px] text-muted-fg">Supercharger</span>
                </div>
              )}
              {chargerFilters.showOtherChargers && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-[#6366f1] opacity-60 border border-white" />
                  <span className="text-[9px] md:text-[10px] text-muted-fg">Other DC fast</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Traffic toggle button — top-right, below legend */}
        {process.env.NEXT_PUBLIC_TOMTOM_API_KEY && routePolyline && (
          <button
            onClick={() => setShowTraffic((v) => !v)}
            className={`absolute z-[400] right-2 md:right-4 ${
              nearbyChargers.length > 0 ? "top-[72px] md:top-[88px]" : "top-2 md:top-4"
            } w-9 h-9 md:w-10 md:h-10 rounded-xl border flex items-center justify-center transition-all ${
              showTraffic
                ? "bg-orange-500/20 border-orange-500/50"
                : "bg-surface/90 border-edge/50"
            } backdrop-blur-sm`}
            title={showTraffic ? "Hide traffic" : "Show traffic"}
          >
            <Activity
              size={16}
              className={showTraffic ? "text-orange-500" : "text-muted-fg"}
            />
          </button>
        )}

        {/* Hide unused chargers button — top-right, below traffic toggle */}
        {routePolyline && nearbyChargers.length > 0 && (
          <button
            onClick={() =>
              setChargerFilters((f) => ({
                ...f,
                hideUnusedChargers: !f.hideUnusedChargers,
              }))
            }
            className={`absolute z-[400] right-2 md:right-4 ${
              process.env.NEXT_PUBLIC_TOMTOM_API_KEY
                ? nearbyChargers.length > 0
                  ? "top-[116px] md:top-[136px]"
                  : "top-[48px] md:top-[56px]"
                : nearbyChargers.length > 0
                  ? "top-[72px] md:top-[88px]"
                  : "top-2 md:top-4"
            } w-9 h-9 md:w-10 md:h-10 rounded-xl border flex items-center justify-center transition-all ${
              chargerFilters.hideUnusedChargers
                ? "bg-[#e31937]/20 border-[#e31937]/50"
                : "bg-surface/90 border-edge/50"
            } backdrop-blur-sm`}
            title={
              chargerFilters.hideUnusedChargers
                ? "Show all chargers"
                : "Hide unused chargers"
            }
          >
            {chargerFilters.hideUnusedChargers ? (
              <EyeOff
                size={16}
                className="text-[#e31937]"
              />
            ) : (
              <Eye size={16} className="text-muted-fg" />
            )}
          </button>
        )}

        {/* Empty state overlay — only on origin step when no route */}
        {!routePolyline && !loading && wizardStep === "origin" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-16 md:pb-0">
            <div className="text-center px-6">
              <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-3 md:mb-4 rounded-full bg-elevated/80 flex items-center justify-center">
                <Zap size={28} className="text-dim-fg md:hidden" />
                <Zap size={32} className="text-dim-fg hidden md:block" />
              </div>
              <p className="text-faint-fg text-xs md:text-sm font-medium">
                Enter your origin and destination
              </p>
              <p className="text-dim-fg text-[11px] md:text-xs mt-1">
                We&apos;ll find the best Supercharger stops along your route
              </p>
            </div>
          </div>
        )}

        {/* Mobile: About bottom sheet (from floating logo button) */}
        {isMobile && mobileAboutOpen && (
          <div className="absolute inset-x-0 bottom-0 z-[500] flex flex-col mobile-sheet-enter">
            <div className="bg-surface/60 backdrop-blur-xl border-t border-edge/50 rounded-t-2xl shadow-2xl flex flex-col max-h-[85dvh]">
              <div className="flex items-center justify-center pt-3 pb-2 shrink-0 w-full">
                <div className="w-8 h-1 rounded-full bg-muted-fg/40" />
              </div>
              <div className="overflow-y-auto overscroll-contain px-4 pb-safe scrollbar-thin">
                <div className="wizard-step-enter space-y-5">
                  <button
                    onClick={() => setMobileAboutOpen(false)}
                    className="flex items-center gap-2 text-xs font-medium text-muted-fg hover:text-foreground transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back to planner
                  </button>

                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">About WattsWay</h2>
                    <p className="text-xs text-faint-fg">The open-source EV trip planner</p>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-elevated/60 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart size={14} className="text-[#e31937]" />
                        <h3 className="text-sm font-semibold text-foreground">Why we built this</h3>
                      </div>
                      <p className="text-xs text-secondary-fg leading-relaxed">
                        Planning a road trip in an EV should be effortless, not stressful. We built WattsWay because existing tools were either locked behind apps, cluttered with ads, or didn&apos;t account for real-world charging needs. We wanted something fast, beautiful, and genuinely useful, a planner that thinks the way drivers do.
                      </p>
                    </div>

                    <div className="bg-elevated/60 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch size={14} className="text-green-400" />
                        <h3 className="text-sm font-semibold text-foreground">Open source</h3>
                      </div>
                      <p className="text-xs text-secondary-fg leading-relaxed">
                        WattsWay will be fully open source. We believe the best EV trip planner should be built by the community that uses it. Whether you&apos;re a developer, a designer, or just someone with a great idea, your contributions can make WattsWay better for every EV driver out there.
                      </p>
                      <a
                        href="https://github.com/wattswayapp/website"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-[#e31937] hover:text-[#ff2d4b] transition-colors"
                      >
                        <GitBranch size={12} />
                        Contribute on GitHub
                      </a>
                    </div>

                    <div className="bg-elevated/60 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={14} className="text-blue-400" />
                        <h3 className="text-sm font-semibold text-foreground">Our vision</h3>
                      </div>
                      <p className="text-xs text-secondary-fg leading-relaxed">
                        We want WattsWay to become the go-to trip planner for every EV, not just Teslas. With community contributions, we can add support for more vehicles, more charger networks, and smarter route optimization. Together, we can build the trip planner the EV world deserves.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href="https://x.com/WattsWayApp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-elevated/80 border border-edge/50 rounded-xl text-xs font-medium text-secondary-fg hover:bg-accent-surface/80 transition-all"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Follow us
                    </a>
                    <button
                      onClick={() => setMobileAboutOpen(false)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#e31937] hover:bg-[#ff2d4b] text-white rounded-xl text-xs font-medium transition-all"
                    >
                      <Zap size={14} />
                      Plan a trip
                    </button>
                  </div>

                  <div className="pt-2 border-t border-edge/30 text-center">
                    <p className="text-[10px] text-dim-fg">
                      v{process.env.NEXT_PUBLIC_APP_VERSION} · Built with Claude Code &amp; Grok · Powered by OpenStreetMap, OSRM &amp; supercharge.info
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile: results bottom sheet OR "Show trip" pill */}
        {isMobile && wizardStep === "results" && !mobileAboutOpen && (
          mobileSheetHidden ? (
            <div className="absolute inset-x-0 bottom-6 z-[500] flex justify-center">
              <button
                onClick={() => {
                  setMobileSheetHidden(false);
                  setMobileSheetExpanded(true);
                }}
                className="flex items-center gap-2 px-5 py-3 bg-surface/80 backdrop-blur-xl border border-edge/50 rounded-full shadow-2xl active:scale-95 transition-transform"
              >
                <MapPin size={16} className="text-[#e31937]" />
                <span className="text-sm font-semibold text-foreground">Show trip</span>
              </button>
            </div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 z-[500] flex flex-col mobile-sheet-enter">
              <div className={`bg-surface/60 backdrop-blur-xl border-t border-edge/50 rounded-t-2xl shadow-2xl flex flex-col transition-[max-height] duration-300 ease-in-out ${mobileSheetExpanded ? "max-h-[70dvh]" : "max-h-[64px]"}`}>
                <button
                  onClick={() => setMobileSheetHidden(true)}
                  onTouchStart={(e) => {
                    touchStartY.current = e.touches[0].clientY;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartY.current === null) return;
                    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
                    touchStartY.current = null;
                    if (Math.abs(deltaY) > 30) {
                      if (deltaY < 0) {
                        setMobileSheetExpanded(true);
                      } else {
                        setMobileSheetHidden(true);
                      }
                    }
                  }}
                  className="flex items-center justify-center pt-3 pb-2 shrink-0 w-full"
                >
                  <div className="w-8 h-1 rounded-full bg-muted-fg/40" />
                </button>
                {!mobileSheetExpanded && trip && (
                  <div className="flex items-center justify-center gap-1.5 px-4 pb-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{trip.origin}</span>
                    <ChevronRight size={10} className="text-dim-fg shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate">{trip.destination}</span>
                  </div>
                )}
                {mobileSheetExpanded && (
                  <div className="overflow-y-auto overscroll-contain px-4 pb-safe scrollbar-thin">
                    {renderStepContent()}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* Mobile: steps 1-3 floating panel at top center */}
        {isMobile && wizardStep !== "results" && !mobileAboutOpen && (
          <div className="absolute z-[500] top-14 left-3 right-3 bg-surface/60 backdrop-blur-xl border border-edge/50 shadow-2xl rounded-2xl flex flex-col safe-area-top max-h-[calc(100dvh-5rem)]">
            <div className="p-4 overflow-y-auto overscroll-contain scrollbar-thin">
              {renderStepContent()}
            </div>
          </div>
        )}

        {/* Desktop: About or Wizard panel */}
        {!isMobile && (
          showAbout ? (
            <div className="absolute z-[500] top-4 left-4 w-[440px] bg-surface/60 backdrop-blur-xl border border-edge/50 shadow-2xl rounded-2xl flex flex-col max-h-[calc(100dvh-5rem)]">
              <div className="p-5 overflow-y-auto overscroll-contain scrollbar-none">
                <div className="wizard-step-enter space-y-5">
                  <button
                    onClick={() => setShowAbout(false)}
                    className="flex items-center gap-2 text-sm font-medium text-muted-fg hover:text-foreground transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back to planner
                  </button>

                  <div>
                    <h2 className="text-xl font-bold text-foreground mb-1">About WattsWay</h2>
                    <p className="text-sm text-faint-fg">The open-source EV trip planner</p>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-elevated/60 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart size={14} className="text-[#e31937]" />
                        <h3 className="text-base font-semibold text-foreground">Why we built this</h3>
                      </div>
                      <p className="text-sm text-secondary-fg leading-relaxed">
                        Planning a road trip in an EV should be effortless, not stressful. We built WattsWay because existing tools were either locked behind apps, cluttered with ads, or didn&apos;t account for real-world charging needs. We wanted something fast, beautiful, and genuinely useful, a planner that thinks the way drivers do.
                      </p>
                    </div>

                    <div className="bg-elevated/60 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch size={14} className="text-green-400" />
                        <h3 className="text-base font-semibold text-foreground">Open source</h3>
                      </div>
                      <p className="text-sm text-secondary-fg leading-relaxed">
                        WattsWay will be fully open source. We believe the best EV trip planner should be built by the community that uses it. Whether you&apos;re a developer, a designer, or just someone with a great idea, your contributions can make WattsWay better for every EV driver out there.
                      </p>
                      <a
                        href="https://github.com/wattswayapp/website"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-[#e31937] hover:text-[#ff2d4b] transition-colors"
                      >
                        <GitBranch size={12} />
                        Contribute on GitHub
                      </a>
                    </div>

                    <div className="bg-elevated/60 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={14} className="text-blue-400" />
                        <h3 className="text-base font-semibold text-foreground">Our vision</h3>
                      </div>
                      <p className="text-sm text-secondary-fg leading-relaxed">
                        We want WattsWay to become the go-to trip planner for every EV, not just Teslas. With community contributions, we can add support for more vehicles, more charger networks, and smarter route optimization. Together, we can build the trip planner the EV world deserves.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a
                      href="https://x.com/WattsWayApp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-elevated/80 border border-edge/50 rounded-xl text-sm font-medium text-secondary-fg hover:bg-accent-surface/80 transition-all"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Follow us
                    </a>
                    <button
                      onClick={() => setShowAbout(false)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#e31937] hover:bg-[#ff2d4b] text-white rounded-xl text-sm font-medium transition-all"
                    >
                      <Zap size={14} />
                      Plan a trip
                    </button>
                  </div>

                  <div className="pt-2 border-t border-edge/30 text-center">
                    <p className="text-[11px] text-dim-fg">
                      v{process.env.NEXT_PUBLIC_APP_VERSION} · Built with Claude Code &amp; Grok · Powered by OpenStreetMap, OSRM &amp; supercharge.info
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`absolute z-[500] top-4 left-4 w-[440px] bg-surface/60 backdrop-blur-xl border border-edge/50 shadow-2xl rounded-2xl flex flex-col ${
                wizardStep === "origin" || wizardStep === "destination"
                  ? ""
                  : "max-h-[calc(100dvh-5rem)]"
              }`}
            >
              <div className={`p-5 ${
                wizardStep === "origin" || wizardStep === "destination"
                  ? ""
                  : "overflow-y-auto overscroll-contain scrollbar-none"
              }`}>
                {renderStepContent()}
              </div>
            </div>
          )
        )}

        {/* Saved Trips Panel */}
        <SavedTripsPanel
          open={savedTripsOpen}
          onClose={() => setSavedTripsOpen(false)}
          onLoadTrip={handleLoadSavedTrip}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
