"use client";

import { TripRoute, TrafficCongestion, ChargerStation } from "@/lib/types";
import { UnitSystem, formatDistance } from "@/lib/units";
import BatteryGauge from "./BatteryGauge";
import {
  Clock,
  Route,
  Zap,
  MapPin,
  ChevronDown,
  ChevronUp,
  Navigation,
  BatteryCharging,
  ExternalLink,
  Copy,
  Share2,
  Check,
  Activity,
  ArrowLeftRight,
  X,
  Star,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { toggleFavoriteCharger, getFavoriteChargers } from "@/lib/favorites";

interface TripSummaryProps {
  trip: TripRoute | null;
  loading: boolean;
  units: UnitSystem;
  startCharge?: number;
  trafficCongestion?: TrafficCongestion | null;
  trafficLoading?: boolean;
  nearbyChargers?: ChargerStation[];
  onSwapStop?: (index: number, newStation: ChargerStation) => void;
  onHighlightCharger?: (chargerId: string | null) => void;
  onSwappingStopChange?: (index: number | null) => void;
}

function haversineDistanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3959;
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

function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function buildGoogleMapsUrl(trip: TripRoute): string {
  const origin = `${trip.originCoords.lat},${trip.originCoords.lng}`;
  const destination = `${trip.destinationCoords.lat},${trip.destinationCoords.lng}`;

  const waypoints = trip.chargingStops
    .map((s) => `${s.station.location.lat},${s.station.location.lng}`)
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  return url;
}

export default function TripSummary({ trip, loading, units, startCharge = 90, trafficCongestion, trafficLoading, nearbyChargers = [], onSwapStop, onHighlightCharger, onSwappingStopChange }: TripSummaryProps) {
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [swappingStop, setSwappingStop] = useState<number | null>(null);
  const [favoriteChargerIds, setFavoriteChargerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavoriteChargerIds(new Set(getFavoriteChargers().map((f) => f.id)));
  }, []);

  const googleMapsUrl = trip ? buildGoogleMapsUrl(trip) : "";

  const handleCopyLink = useCallback(async () => {
    if (!googleMapsUrl) return;
    try {
      await navigator.clipboard.writeText(googleMapsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = googleMapsUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [googleMapsUrl]);

  const handleNativeShare = useCallback(async () => {
    if (!trip) return;
    const text = [
      `Trip: ${trip.origin} → ${trip.destination}`,
      `Distance: ${formatDistance(trip.distance, units)}`,
      `Total time: ${formatDuration(trip.totalTripTime)}`,
      trip.chargingStops.length > 0
        ? `Charging stops: ${trip.chargingStops.length} (${formatDuration(trip.totalChargeTime)} total)`
        : "No charging stops needed",
      "",
      "Open in Google Maps:",
      googleMapsUrl,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trip: ${trip.origin} → ${trip.destination}`,
          text,
          url: googleMapsUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [trip, googleMapsUrl, units]);

  if (loading) {
    return (
      <div className="mt-0 space-y-3">
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-elevated/50 rounded-xl" />
          <div className="h-16 bg-elevated/50 rounded-xl" />
          <div className="h-16 bg-elevated/50 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!trip) return null;

  return (
    <div className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Trip Overview Stats */}
      <div className="bg-gradient-to-br from-elevated/80 to-surface/80 border border-edge/40 rounded-2xl p-3 md:p-4">
        <h3 className="text-[10px] md:text-sm font-semibold text-muted-fg uppercase tracking-wider mb-2.5 md:mb-3">
          Trip Overview
        </h3>
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="bg-elevated/60 rounded-xl p-2.5 md:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Route size={12} className="text-[#e31937] md:w-[14px] md:h-[14px]" />
              <span className="text-[10px] md:text-xs text-faint-fg uppercase">Distance</span>
            </div>
            <span className="text-base md:text-xl font-bold text-foreground">
              {formatDistance(trip.distance, units)}
            </span>
          </div>
          <div className="bg-elevated/60 rounded-xl p-2.5 md:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-[#e31937] md:w-[14px] md:h-[14px]" />
              <span className="text-[10px] md:text-xs text-faint-fg uppercase">Total Time</span>
            </div>
            <span className="text-base md:text-xl font-bold text-foreground">
              {formatDuration(trip.totalTripTime)}
            </span>
          </div>
          <div className="bg-elevated/60 rounded-xl p-2.5 md:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={12} className="text-yellow-400 md:w-[14px] md:h-[14px]" />
              <span className="text-[10px] md:text-xs text-faint-fg uppercase">Charge Time</span>
            </div>
            <span className="text-base md:text-xl font-bold text-foreground">
              {formatDuration(trip.totalChargeTime)}
            </span>
          </div>
          <div className="bg-elevated/60 rounded-xl p-2.5 md:p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BatteryCharging size={12} className="text-green-400 md:w-[14px] md:h-[14px]" />
              <span className="text-[10px] md:text-xs text-faint-fg uppercase">Stops</span>
            </div>
            <span className="text-base md:text-xl font-bold text-foreground">
              {trip.chargingStops.length}
            </span>
          </div>
        </div>

        {/* Traffic congestion indicator */}
        {trafficLoading && (
          <div className="mt-2 md:mt-3 bg-elevated/60 rounded-xl p-2.5 md:p-3 animate-pulse">
            <div className="h-4 bg-surface/60 rounded w-2/3" />
            <div className="h-1.5 bg-surface/60 rounded-full mt-2 w-full" />
          </div>
        )}
        {trafficCongestion && !trafficLoading && (
          <div className="mt-2 md:mt-3 bg-elevated/60 rounded-xl p-2.5 md:p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Activity size={12} style={{ color: trafficCongestion.color }} />
                <span className="text-[10px] md:text-xs text-faint-fg uppercase font-medium">Traffic</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-semibold" style={{ color: trafficCongestion.color }}>
                  {trafficCongestion.level}
                </span>
                {trafficCongestion.estimatedDelayMinutes > 0 && (
                  <span className="text-[11px] md:text-xs text-muted-fg">
                    +{trafficCongestion.estimatedDelayMinutes} min
                  </span>
                )}
              </div>
            </div>
            <div className="w-full h-1.5 bg-surface/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(5, trafficCongestion.averageCongestion * 100)}%`,
                  backgroundColor: trafficCongestion.color,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Share / Export */}
      <div className="flex gap-1.5 md:gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-2.5 md:py-3 bg-elevated/80 border border-edge/50 rounded-xl text-[11px] md:text-sm font-medium text-secondary-fg hover:bg-accent-surface/80 hover:border-accent-surface active:scale-[0.98] transition-all min-h-[44px]"
        >
          <ExternalLink size={13} />
          <span className="hidden xs:inline">Open in </span>Google Maps
        </a>
        <button
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-1.5 py-2.5 md:py-3 px-2.5 md:px-3.5 bg-elevated/80 border border-edge/50 rounded-xl text-[11px] md:text-sm font-medium text-secondary-fg hover:bg-accent-surface/80 hover:border-accent-surface active:scale-[0.98] transition-all min-h-[44px]"
        >
          {copied ? (
            <>
              <Check size={13} className="text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy
            </>
          )}
        </button>
        <button
          onClick={handleNativeShare}
          className="flex items-center justify-center py-2.5 md:py-3 px-2.5 md:px-3.5 bg-elevated/80 border border-edge/50 rounded-xl text-[11px] md:text-sm font-medium text-secondary-fg hover:bg-accent-surface/80 hover:border-accent-surface active:scale-[0.98] transition-all min-h-[44px]"
        >
          <Share2 size={13} />
        </button>
      </div>

      {/* Route Timeline */}
      <div className="bg-gradient-to-br from-elevated/80 to-surface/80 border border-edge/40 rounded-2xl p-3 md:p-4">
        <h3 className="text-[10px] md:text-sm font-semibold text-muted-fg uppercase tracking-wider mb-2.5 md:mb-3">
          Route
        </h3>

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-green-500 via-[#e31937] to-red-500" />

          {/* Start */}
          <div className="flex items-start gap-3 mb-4 relative">
            <div className="w-[32px] h-[32px] rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center shrink-0 z-10">
              <Navigation size={12} className="text-green-400" />
            </div>
            <div className="pt-1 min-w-0 flex-1">
              <p className="text-sm md:text-base font-medium text-foreground truncate">
                {trip.origin}
              </p>
              <p className="text-[11px] md:text-xs text-faint-fg">Start · {startCharge}% charge</p>
            </div>
          </div>

          {/* Charging Stops */}
          {trip.chargingStops.map((stop, idx) => (
            <div key={idx} className="relative mb-4">
              <button
                onClick={() =>
                  setExpandedStop(expandedStop === idx ? null : idx)
                }
                className="w-full flex items-start gap-3 text-left group min-h-[44px]"
              >
                <div className="w-[32px] h-[32px] rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shrink-0 z-10">
                  <Zap size={12} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm md:text-base font-medium text-foreground truncate">
                      {stop.station.name}
                    </p>
                    <div className="shrink-0">
                      {expandedStop === idx ? (
                        <ChevronUp size={14} className="text-faint-fg" />
                      ) : (
                        <ChevronDown size={14} className="text-faint-fg" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] md:text-xs text-faint-fg">
                      {formatDistance(stop.distanceFromStart, units)}
                    </span>
                    <span className="text-[11px] md:text-xs text-dim-fg">·</span>
                    <span className="text-[11px] md:text-xs text-yellow-500 font-medium">
                      {stop.chargeTime} min charge
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {expandedStop === idx && (
                <div className="ml-[44px] mt-2 bg-elevated/60 rounded-xl p-2.5 md:p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-start gap-2 text-[11px] md:text-sm text-muted-fg">
                    <MapPin size={11} className="shrink-0 mt-0.5" />
                    <span className="break-words">{stop.station.address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] md:text-xs text-faint-fg block">Arrive</span>
                      <BatteryGauge percentage={stop.arrivalCharge} size="sm" />
                    </div>
                    <div className="flex items-center gap-1 text-dim-fg">
                      <Zap size={10} />
                      <span className="text-[10px] md:text-xs">{stop.chargeTime} min</span>
                    </div>
                    <div>
                      <span className="text-[10px] md:text-xs text-faint-fg block">Depart</span>
                      <BatteryGauge percentage={stop.departureCharge} size="sm" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] md:text-xs text-faint-fg">
                    <span>{stop.station.numStalls} stalls · {stop.station.power} kW</span>
                    <span className="text-dim-fg">{stop.station.network}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {stop.station.locationId ? (
                      <a
                        href={`https://www.tesla.com/findus/location/supercharger/${stop.station.locationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-medium text-[#e31937] hover:text-[#ff2d4b] transition-colors"
                      >
                        <ExternalLink size={11} />
                        View on Tesla.com
                      </a>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => {
                        const nowFav = toggleFavoriteCharger(stop.station);
                        setFavoriteChargerIds((prev) => {
                          const next = new Set(prev);
                          if (nowFav) next.add(stop.station.id);
                          else next.delete(stop.station.id);
                          return next;
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-surface/60 transition-colors"
                      title={favoriteChargerIds.has(stop.station.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star
                        size={14}
                        className={favoriteChargerIds.has(stop.station.id) ? "text-yellow-400 fill-yellow-400" : "text-faint-fg"}
                      />
                    </button>
                  </div>
                  {onSwapStop && (
                    <div className="pt-2.5 mt-2.5 border-t border-edge/30">
                      <button
                        onClick={() => {
                          const next = swappingStop === idx ? null : idx;
                          setSwappingStop(next);
                          onSwappingStopChange?.(next);
                        }}
                        className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] md:text-xs font-medium text-secondary-fg hover:text-foreground hover:bg-surface/60 transition-colors"
                      >
                        <ArrowLeftRight size={11} />
                        {swappingStop === idx ? "Hide alternatives" : "Swap charger"}
                      </button>
                      {swappingStop === idx && (() => {
                        const plannedIds = new Set(trip!.chargingStops.map(s => s.station.id));
                        const alternatives = nearbyChargers
                          .filter(c => !plannedIds.has(c.id))
                          .map(c => ({
                            station: c,
                            distMiles: haversineDistanceMiles(stop.station.location, c.location),
                          }))
                          .filter(a => a.distMiles <= 50)
                          .sort((a, b) => a.distMiles - b.distMiles);

                        if (alternatives.length === 0) {
                          return (
                            <div className="mt-3 bg-surface/40 rounded-xl p-3 text-center">
                              <Zap size={16} className="mx-auto text-dim-fg mb-1" />
                              <p className="text-[11px] md:text-xs text-faint-fg">
                                No alternative chargers within 50 miles.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="mt-3">
                            <p className="text-[10px] md:text-xs text-faint-fg uppercase tracking-wider font-medium mb-2">
                              {alternatives.length} alternative{alternatives.length !== 1 ? "s" : ""} nearby
                            </p>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin pr-0.5">
                              {alternatives.map(alt => (
                                <div
                                  key={alt.station.id}
                                  className="relative flex items-start bg-surface/50 hover:bg-accent-surface/70 border border-edge/30 hover:border-[#e31937]/40 rounded-xl p-2.5 transition-all group"
                                  onMouseEnter={() => onHighlightCharger?.(alt.station.id)}
                                  onMouseLeave={() => onHighlightCharger?.(null)}
                                >
                                  <button
                                    onClick={() => {
                                      onSwapStop(idx, alt.station);
                                      setSwappingStop(null);
                                      onSwappingStopChange?.(null);
                                      onHighlightCharger?.(null);
                                    }}
                                    className="flex-1 text-left flex items-start gap-2.5 min-w-0"
                                  >
                                    <div className="w-7 h-7 rounded-full bg-[#e31937]/10 group-hover:bg-[#e31937]/20 border border-[#e31937]/20 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                                      <Zap size={12} className="text-[#e31937]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] md:text-xs font-semibold text-foreground truncate leading-tight">
                                        {alt.station.name}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                        <span className="inline-flex items-center gap-1 text-[10px] md:text-[11px] text-muted-fg bg-elevated/80 rounded-md px-1.5 py-0.5">
                                          <Navigation size={8} />
                                          {formatDistance(alt.distMiles, units)}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] md:text-[11px] text-muted-fg bg-elevated/80 rounded-md px-1.5 py-0.5">
                                          {alt.station.numStalls} stalls
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] md:text-[11px] text-muted-fg bg-elevated/80 rounded-md px-1.5 py-0.5">
                                          <Zap size={8} />
                                          {alt.station.power} kW
                                        </span>
                                      </div>
                                      <p className="text-[10px] md:text-[11px] text-dim-fg mt-1 truncate">
                                        {alt.station.network}
                                      </p>
                                    </div>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nowFav = toggleFavoriteCharger(alt.station);
                                      setFavoriteChargerIds((prev) => {
                                        const next = new Set(prev);
                                        if (nowFav) next.add(alt.station.id);
                                        else next.delete(alt.station.id);
                                        return next;
                                      });
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-elevated/80 transition-colors shrink-0 ml-1"
                                    title={favoriteChargerIds.has(alt.station.id) ? "Remove from favorites" : "Add to favorites"}
                                  >
                                    <Star
                                      size={13}
                                      className={favoriteChargerIds.has(alt.station.id) ? "text-yellow-400 fill-yellow-400" : "text-faint-fg"}
                                    />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Destination */}
          <div className="flex items-start gap-3 relative">
            <div className="w-[32px] h-[32px] rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shrink-0 z-10">
              <MapPin size={12} className="text-red-400" />
            </div>
            <div className="pt-1 min-w-0 flex-1">
              <p className="text-sm md:text-base font-medium text-foreground truncate">
                {trip.destination}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] md:text-xs text-faint-fg">Arrive</span>
                <BatteryGauge percentage={trip.arrivalCharge} size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
