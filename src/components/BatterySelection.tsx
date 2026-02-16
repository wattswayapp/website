"use client";

import { useState, useCallback } from "react";
import { TeslaModel } from "@/lib/types";
import { milesToKm } from "@/lib/units";
import { ChevronLeft, Zap } from "lucide-react";

interface BatterySelectionProps {
  model: TeslaModel;
  onContinue: (charge: number) => void;
  onBack: () => void;
}

function getBatteryColor(pct: number): string {
  if (pct > 60) return "#22c55e";
  if (pct > 30) return "#eab308";
  if (pct > 15) return "#f97316";
  return "#ef4444";
}

export default function BatterySelection({
  model,
  onContinue,
  onBack,
}: BatterySelectionProps) {
  const [charge, setCharge] = useState(90);
  const color = getBatteryColor(charge);
  const rangeAtChargeMi = Math.round(model.range * (charge / 100));
  const rangeAtChargeKm = Math.round(milesToKm(model.range) * (charge / 100));

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCharge(Number(e.target.value));
    },
    []
  );

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex flex-col items-center justify-center p-4 md:p-6 overflow-auto safe-area-top safe-area-bottom">
      <div className="w-full max-w-lg onboarding-fade-in">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-6 md:mb-8 transition-colors min-h-[44px]"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-6 md:mb-10">
          <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-2 md:mb-3">
            Starting charge
          </h1>
          <p className="text-zinc-400 text-xs md:text-base">
            Set your current battery level for <span className="text-white font-medium">{model.name}</span>
          </p>
        </div>

        {/* Battery visualization */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 md:p-8 mb-6 md:mb-8">
          {/* Large percentage */}
          <div className="text-center mb-5 md:mb-6">
            <span
              className="text-5xl md:text-7xl font-bold tabular-nums transition-colors duration-300"
              style={{ color }}
            >
              {charge}
            </span>
            <span className="text-2xl md:text-4xl font-bold text-zinc-500">%</span>
          </div>

          {/* Battery bar */}
          <div className="relative w-full h-10 md:h-14 bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 mb-5 md:mb-6">
            {/* Battery tip */}
            <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-2 h-5 md:h-6 bg-zinc-700 rounded-r-sm" />
            {/* Fill */}
            <div
              className="h-full rounded-lg transition-all duration-150 battery-fill-glow"
              style={{
                width: `${charge}%`,
                background: `linear-gradient(90deg, ${color}cc, ${color})`,
                boxShadow: `0 0 20px ${color}40`,
              }}
            />
          </div>

          {/* Slider */}
          <input
            type="range"
            min={10}
            max={100}
            value={charge}
            onChange={handleSliderChange}
            className="w-full h-2 rounded-full appearance-none cursor-pointer onboarding-slider"
            style={{
              background: `linear-gradient(to right, ${color} 0%, ${color} ${((charge - 10) / 90) * 100}%, #3f3f46 ${((charge - 10) / 90) * 100}%, #3f3f46 100%)`,
            }}
          />
          <div className="flex justify-between text-[11px] text-zinc-600 mt-2">
            <span>10%</span>
            <span>100%</span>
          </div>

          {/* Range info */}
          <div className="mt-5 md:mt-6 flex items-center justify-center gap-3 bg-zinc-800/60 rounded-xl p-3">
            <Zap size={16} className="text-[#e31937]" />
            <span className="text-zinc-300 text-xs md:text-sm">
              <span className="text-white font-bold">{rangeAtChargeKm} km</span>
              <span className="text-zinc-500 text-[11px] md:text-xs ml-1.5">({rangeAtChargeMi} mi)</span>
              {" "}estimated range
            </span>
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={() => onContinue(charge)}
          className="w-full py-3.5 md:py-4 bg-[#e31937] hover:bg-[#ff2d4b] active:bg-[#c41530] text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-red-900/30 text-sm md:text-base active:scale-[0.98]"
        >
          Continue and plan your trip
        </button>
      </div>
    </div>
  );
}
