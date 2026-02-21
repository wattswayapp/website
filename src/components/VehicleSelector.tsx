"use client";

import { TeslaModel } from "@/lib/types";
import { TESLA_MODELS } from "@/lib/tesla-models";
import { UnitSystem, convertDistance, distanceLabel } from "@/lib/units";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const MODEL_IMAGES: Record<string, string> = {
  "model-3": "/vehicles/model-3.png",
  "model-y": "/vehicles/model-y.png",
  "model-s": "/vehicles/model-s.png",
  "model-x": "/vehicles/model-x.png",
  "cybertruck": "/vehicles/cybertruck.jpg",
};

const MODEL_GROUPS = [
  { label: "Model 3", prefix: "model-3", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-3")) },
  { label: "Model Y", prefix: "model-y", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-y")) },
  { label: "Model S", prefix: "model-s", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-s")) },
  { label: "Model X", prefix: "model-x", models: TESLA_MODELS.filter((m) => m.id.startsWith("model-x")) },
  { label: "Cybertruck", prefix: "cybertruck", models: TESLA_MODELS.filter((m) => m.id.startsWith("cybertruck")) },
];

function getModelPrefix(modelId: string): string {
  if (modelId.startsWith("model-3")) return "model-3";
  if (modelId.startsWith("model-y")) return "model-y";
  if (modelId.startsWith("model-s")) return "model-s";
  if (modelId.startsWith("model-x")) return "model-x";
  if (modelId.startsWith("cybertruck")) return "cybertruck";
  return "model-3";
}

interface VehicleSelectorProps {
  selected: TeslaModel;
  onSelect: (model: TeslaModel) => void;
  units: UnitSystem;
}

export default function VehicleSelector({
  selected,
  onSelect,
  units,
}: VehicleSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unit = distanceLabel(units);
  const selectedPrefix = getModelPrefix(selected.id);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref}>
      <label className="block text-[11px] md:text-xs font-medium text-muted-fg uppercase tracking-wider mb-1.5">
        Select the Tesla you drive
      </label>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between bg-elevated/80 border border-edge/50 py-2.5 md:py-3 px-3 md:px-4 text-sm md:text-base text-foreground hover:border-accent-surface transition-all ${
          open ? "rounded-t-xl" : "rounded-xl"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={MODEL_IMAGES[selectedPrefix]}
            alt={selected.name}
            className="w-10 h-6 md:w-12 md:h-7 object-contain shrink-0"
          />
          <span className="truncate">{selected.name}</span>
          <span className="text-faint-fg text-xs md:text-sm shrink-0">
            {Math.round(convertDistance(selected.range, units))} {unit}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted-fg transition-transform duration-300 shrink-0 ml-2 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="max-h-64 md:max-h-80 overflow-y-auto bg-elevated border border-t-0 border-edge/50 rounded-b-xl scrollbar-thin">
            {MODEL_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-semibold text-faint-fg uppercase tracking-wider bg-surface/50 sticky top-0 flex items-center gap-2">
                  <img
                    src={MODEL_IMAGES[group.prefix]}
                    alt={group.label}
                    className="w-8 h-5 md:w-9 md:h-5 object-contain"
                  />
                  {group.label}
                </div>
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelect(model);
                      setOpen(false);
                    }}
                    className={`w-full px-3 md:px-4 py-3 md:py-2.5 text-left flex items-center justify-between hover:bg-accent-surface/50 active:bg-accent-surface transition-colors ${
                      selected.id === model.id ? "bg-[#e31937]/10" : ""
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        selected.id === model.id
                          ? "text-[#e31937]"
                          : "text-secondary-fg"
                      }`}
                    >
                      {model.name}
                    </span>
                    <span className="text-xs md:text-sm text-faint-fg">
                      {Math.round(convertDistance(model.range, units))} {unit} range
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
