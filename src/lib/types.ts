export interface LatLng {
  lat: number;
  lng: number;
}

export interface TeslaModel {
  id: string;
  name: string;
  range: number; // miles
  efficiency: number; // Wh/mi
  batteryCapacity: number; // kWh
  maxChargeRate: number; // kW
}

export interface ChargerStation {
  id: string;
  name: string;
  location: LatLng;
  address: string;
  numStalls: number;
  power: number; // kW
  status: "available" | "busy" | "unknown";
  network: string;
  distance?: number; // distance from route in meters
  locationId?: string; // Tesla supercharger location ID for tesla.com links
}

export interface ChargingStop {
  station: ChargerStation;
  arrivalCharge: number; // percentage
  departureCharge: number; // percentage
  chargeTime: number; // minutes
  distanceFromStart: number; // miles
  distanceToNext: number; // miles
}

export interface TripRoute {
  origin: string;
  destination: string;
  originCoords: LatLng;
  destinationCoords: LatLng;
  distance: number; // miles
  duration: number; // minutes
  polyline: LatLng[];
  chargingStops: ChargingStop[];
  arrivalCharge: number; // percentage at destination
  totalChargeTime: number; // minutes
  totalTripTime: number; // minutes
}

export interface GeocodeSuggestion {
  displayName: string;
  lat: number;
  lng: number;
}

export interface TrafficCongestion {
  averageCongestion: number; // 0.0 = free flow, 1.0 = gridlock
  sampleCount: number;
  estimatedDelayMinutes: number;
  level: "Light" | "Moderate" | "Heavy" | "Severe";
  color: string; // hex color
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SavedTrip {
  id: string;
  label: string;               // defaults to "origin → destination"
  savedAt: number;             // Date.now()
  modelId: string;
  modelName: string;
  startCharge: number;
  trip: TripRoute;             // polyline will be []
}

export interface FavoriteLocation {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
  savedAt: number;
}

export interface FavoriteCharger {
  id: string;           // matches ChargerStation.id
  station: ChargerStation;
  savedAt: number;
}
