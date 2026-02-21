"use client";

import { useState } from "react";
import { TeslaModel } from "@/lib/types";
import { TESLA_MODELS } from "@/lib/tesla-models";
import { milesToKm } from "@/lib/units";
import { ChevronLeft } from "lucide-react";

const MODEL_GROUPS = [
  { label: "Model 3", prefix: "model-3", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-3")) },
  { label: "Model Y", prefix: "model-y", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-y")) },
  { label: "Model S", prefix: "model-s", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-s")) },
  { label: "Model X", prefix: "model-x", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-x")) },
  { label: "Cybertruck", prefix: "cybertruck", models: TESLA_MODELS.filter((m) => m.id.startsWith("cybertruck")) },
];

const MODEL_IMAGES: Record<string, string> = {
  "model-3": "/vehicles/model-3.png",
  "model-y": "/vehicles/model-y.png",
  "model-s": "/vehicles/model-s.png",
  "model-x": "/vehicles/model-x.png",
  "cybertruck": "/vehicles/cybertruck.jpg",
};

interface CarSelectionProps {
  onSelect: (model: TeslaModel) => void;
}

export default function CarSelection({ onSelect }: CarSelectionProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const activeGroup = MODEL_GROUPS.find((g) => g.prefix === selectedGroup);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex flex-col items-center justify-center p-4 md:p-6 overflow-auto safe-area-top safe-area-bottom">
      <div className="w-full max-w-4xl onboarding-fade-in">
        {/* Header */}
        <div className="text-center mb-6 md:mb-10">
          <p className="wattway-logo text-white !text-[15px] md:!text-[19px] mb-3 md:mb-4">WATTSWAY</p>
          <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-2 md:mb-3">
            Choose your Tesla
          </h1>
          <p className="text-zinc-400 text-xs md:text-base">
            Select your vehicle to get accurate range and charging estimates
          </p>
        </div>

        {/* Model Group Cards */}
        {!selectedGroup && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {MODEL_GROUPS.map((group, idx) => (
              <button
                key={group.prefix}
                onClick={() => setSelectedGroup(group.prefix)}
                className="group relative bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3 md:p-4 flex flex-col items-center gap-2 md:gap-3 hover:border-zinc-600 hover:bg-zinc-800/80 active:scale-[0.97] md:hover:scale-[1.03] transition-all duration-200 onboarding-card-stagger"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <div className="w-full aspect-[16/10] relative overflow-hidden rounded-xl bg-zinc-800/50">
                  <img
                    src={MODEL_IMAGES[group.prefix]}
                    alt={group.label}
                    className="w-full h-full object-contain object-center"
                    loading="eager"
                  />
                </div>
                <span className="text-white font-semibold text-sm md:text-base">
                  {group.label}
                </span>
                <span className="text-zinc-500 text-[10px] md:text-[11px]">
                  {group.models.length} variant{group.models.length > 1 ? "s" : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Variant Picker */}
        {selectedGroup && activeGroup && (
          <div className="onboarding-fade-in">
            <button
              onClick={() => setSelectedGroup(null)}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-4 md:mb-6 transition-colors min-h-[44px]"
            >
              <ChevronLeft size={16} />
              Back to models
            </button>

            <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center">
              {/* Car Image */}
              <div className="w-full md:w-1/2 aspect-[16/10] relative overflow-hidden rounded-2xl bg-zinc-800/30 border border-zinc-800">
                <img
                  src={MODEL_IMAGES[selectedGroup]}
                  alt={activeGroup.label}
                  className="w-full h-full object-contain object-center"
                />
              </div>

              {/* Variants */}
              <div className="w-full md:w-1/2 space-y-2.5 md:space-y-3">
                <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">
                  {activeGroup.label}
                </h2>
                {activeGroup.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => onSelect(model)}
                    className="w-full flex items-center justify-between bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 md:p-4 hover:border-[#e31937]/50 hover:bg-zinc-800/80 active:scale-[0.98] transition-all duration-200 group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-left text-sm md:text-base">
                        {model.name}
                      </p>
                      <p className="text-zinc-500 text-[11px] md:text-xs text-left mt-0.5">
                        {model.batteryCapacity} kWh · {model.maxChargeRate} kW max
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[#e31937] font-bold text-base md:text-lg">
                        {Math.round(milesToKm(model.range))}
                        <span className="text-xs md:text-sm font-medium text-zinc-500"> km</span>
                      </p>
                      <p className="text-zinc-500 text-[10px]">
                        {model.range} mi
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
