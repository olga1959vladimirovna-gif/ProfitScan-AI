/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vehicle, Driver, Trip, Expenses, AIAnalysis } from '../types.ts';

const SYSTEM_INSTRUCTION = `You are ProfitScan AI, an intelligent logistics analyst.
Your goal is to analyze trip data and provide:
1. Risk Forecast: Analyze delay probability based on season, cargo type, and route.
2. Fuel Optimization: Recommend regions or strategies for cheaper refueling.
3. Negotiation Advice: Provide a persuasive argument for a dispatcher to raise the freight rate based on the numbers.

Return the response ONLY as valid JSON with the following structure, no other text:
{
  "riskForecast": "string",
  "fuelOptimization": "string",
  "negotiationAdvice": "string",
  "summary": "string"
}`;

export async function analyzeTrip(
  trip: Trip,
  vehicle: Vehicle,
  driver: Driver,
  expenses: Expenses,
  margin: number,
  language: string
): Promise<AIAnalysis> {
  const languageName = language === 'ru' ? 'Russian' : 'English';
  const prompt = `Analyze the following trip and provide your response in ${languageName}:
  - Route: ${trip.origin} to ${trip.destination}
  - Distance: ${trip.plannedDistance} km
  - Cargo: ${trip.cargoType}
  - Load Level: ${trip.loadLevel}%
  - Season: ${trip.season}
  - Vehicle: ${vehicle.model}
  - Freight Rate: ${trip.freightRate} RUB
  - Current Margin: ${margin.toFixed(2)}%
  - Fuel Price: ${expenses.fuelPrice} RUB/L
  - Toll Roads: ${expenses.tollRoads} RUB`;

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, system: SYSTEM_INSTRUCTION }),
  });

  const data = await response.json();
  return data;
}

export async function getDistance(
  origin: string,
  destination: string
): Promise<number> {
  const geocode = async (place: string) => {
    const url = 'https://nominatim.openstreetmap.org/search'
      + '?q=' + encodeURIComponent(place)
      + '&format=json&limit=1';
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    const data = await res.json();
    if (!data.length) throw new Error('Place not found: ' + place);
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    };
  };

  try {
    const [from, to] = await Promise.all([
      geocode(origin),
      geocode(destination),
    ]);
    const osrmUrl = 'https://router.project-osrm.org/route/v1/driving/'
      + from.lon + ',' + from.lat + ';'
      + to.lon + ',' + to.lat
      + '?overview=false';
    const res = await fetch(osrmUrl);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return Math.round(data.routes[0].distance / 1000);
    }
    return 0;
  } catch {
    return 0;
  }
}
