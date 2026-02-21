"use client";

import { SavedTrip } from "@/lib/types";
import { getSavedTrips, deleteSavedTrip } from "@/lib/saved-trips";
import { useState, useEffect } from "react";
import {
  Bookmark,
  Trash2,
  X,
  Route,
  Clock,
  Zap,
  ChevronRight,
} from "lucide-react";

interface SavedTripsPanelProps {
  open: boolean;
  onClose: () => void;
  onLoadTrip: (trip: SavedTrip) => void;
  isMobile: boolean;
}

function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function SavedTripsPanel({
  open,
  onClose,
  onLoadTrip,
  isMobile,
}: SavedTripsPanelProps) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);

  useEffect(() => {
    if (open) {
      setTrips(getSavedTrips());
    }
  }, [open]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSavedTrip(id);
    setTrips((prev) => prev.filter((t) => t.id !== id));
  };

  if (!open) return null;

  return (
    <div
      className={
        isMobile
          ? "fixed inset-0 z-[700] bg-surface/98 backdrop-blur-xl flex flex-col safe-area-top"
          : "absolute top-4 left-4 z-[500] w-[440px] max-h-[calc(100dvh-5rem)] bg-surface/60 backdrop-blur-xl border border-edge/50 shadow-2xl rounded-2xl flex flex-col"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge/30 shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark size={16} className="text-[#e31937]" />
          <span className="text-sm font-semibold text-foreground">
            Saved Trips
          </span>
          {trips.length > 0 && (
            <span className="text-[10px] text-dim-fg bg-elevated px-1.5 py-0.5 rounded-full">
              {trips.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-elevated/80 border border-edge/50 flex items-center justify-center hover:bg-accent-surface transition-colors"
        >
          <X size={14} className="text-muted-fg" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2 scrollbar-thin">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-elevated/80 flex items-center justify-center mb-3">
              <Bookmark size={24} className="text-dim-fg" />
            </div>
            <p className="text-sm font-medium text-muted-fg">
              No saved trips yet
            </p>
            <p className="text-xs text-dim-fg mt-1">
              Plan a trip and tap Save to keep it here
            </p>
          </div>
        ) : (
          trips.map((saved) => (
            <div
              key={saved.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onLoadTrip(saved);
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onLoadTrip(saved);
                  onClose();
                }
              }}
              className="w-full text-left bg-elevated/60 hover:bg-elevated border border-edge/40 hover:border-edge/70 rounded-xl p-3 transition-all group cursor-pointer"
            >
              {/* Route label */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs font-semibold text-foreground truncate">
                  {saved.trip.origin}
                </span>
                <ChevronRight
                  size={11}
                  className="text-dim-fg shrink-0"
                />
                <span className="text-xs font-semibold text-foreground truncate">
                  {saved.trip.destination}
                </span>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] text-dim-fg">
                  {relativeDate(saved.savedAt)}
                </span>
                <span className="text-[10px] text-dim-fg">
                  {saved.modelName}
                </span>
              </div>

              {/* Chips + delete */}
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-fg bg-surface/80 px-1.5 py-0.5 rounded">
                  <Route size={9} />
                  {Math.round(saved.trip.distance)} mi
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-fg bg-surface/80 px-1.5 py-0.5 rounded">
                  <Clock size={9} />
                  {formatDuration(saved.trip.totalTripTime)}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-fg bg-surface/80 px-1.5 py-0.5 rounded">
                  <Zap size={9} />
                  {saved.trip.chargingStops.length} stop
                  {saved.trip.chargingStops.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={(e) => handleDelete(saved.id, e)}
                  className={`ml-auto w-6 h-6 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors ${
                    isMobile
                      ? "text-dim-fg"
                      : "text-transparent group-hover:text-dim-fg"
                  } hover:!text-red-400`}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
