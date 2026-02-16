"use client";

import { UnitSystem } from "@/lib/units";

interface UnitToggleProps {
  units: UnitSystem;
  onChange: (units: UnitSystem) => void;
}

export default function UnitToggle({ units, onChange }: UnitToggleProps) {
  return (
    <div className="relative">
      <label className="block text-[11px] font-medium text-muted-fg uppercase tracking-wider mb-1.5">
        Units
      </label>
      <div className="flex bg-elevated/80 border border-edge/50 rounded-xl p-1">
        <button
          onClick={() => onChange("imperial")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            units === "imperial"
              ? "bg-[#e31937] text-white shadow-sm"
              : "text-muted-fg hover:text-secondary-fg"
          }`}
        >
          Miles (mi)
        </button>
        <button
          onClick={() => onChange("metric")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            units === "metric"
              ? "bg-[#e31937] text-white shadow-sm"
              : "text-muted-fg hover:text-secondary-fg"
          }`}
        >
          Kilometers (km)
        </button>
      </div>
    </div>
  );
}
