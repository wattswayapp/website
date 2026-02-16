"use client";

import { useState, useEffect } from "react";
import { TeslaModel } from "@/lib/types";
import { TESLA_MODELS } from "@/lib/tesla-models";
import TripPlanner from "./TripPlanner";

const STORAGE_KEY = "ttp-onboarding";

export default function OnboardingFlow() {
  const [hydrated, setHydrated] = useState(false);
  const [initialModel, setInitialModel] = useState<TeslaModel>(TESLA_MODELS[1]);
  const [initialCharge, setInitialCharge] = useState(90);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.modelId) {
          const model = TESLA_MODELS.find((m) => m.id === data.modelId);
          if (model) setInitialModel(model);
        }
        if (data.startCharge) setInitialCharge(data.startCharge);
      }
    } catch {
      // localStorage unavailable
    }
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  return (
    <TripPlanner
      initialModel={initialModel}
      initialStartCharge={initialCharge}
    />
  );
}
