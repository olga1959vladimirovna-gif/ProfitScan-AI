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

Return the response ONLY as valid JSON, no markdown, no other text:
{"riskForecast":"...","fuelOptimization":"...","negotiationAdvice":"...","summary":"..."}`;

export async function analyzeTrip(
  trip: Trip,
  vehicle: Vehicle,
  driver: Driver,
  expenses: Expenses,
  margin: number,
  language: string
): Promise<AIAnalysis> {
  const languageName = language === 'ru' ? 'Russian' : 'English';
  const prompt = `Analyze this trip in ${languageName}: Route: ${trip.origin} to ${trip.destination}, Distance: ${trip.plannedDistance} km, Cargo: ${trip.cargoType}, Load: ${trip.loadLevel}%, Season: ${trip.season}, Vehicle: ${vehicle.model}, Rate: ${trip.freightRate} RUB, Margin: ${margin.toFixed(2)}%, Fuel: ${expenses.fuelPrice} RUB/L, Tolls: ${expenses.tollRoads} RUB`;

  const key = import.meta.env.VITE_ANTHROPIC_API_KEY;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_INSTRUCTION,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export async function getDistance(
  origin: string,
  destination: string
): Promise<number> {
  const geocode = async (place: string) => {
    const url = 'https://nominatim.openstreetmap.org/search?q='
      + encodeURIComponent(place) + '&format=json&limit=1';
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (!data.length) throw new Error('Not found: ' + place);
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  };
  try {
    const [from, to] = await Promise.all([geocode(origin), geocode(destination)]);
    const url = 'https://router.project-osrm.org/route/v1/driving/'
      + from.lon + ',' + from.lat + ';' + to.lon + ',' + to.lat + '?overview=false';
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.length > 0) return Math.round(data.routes[0].distance / 1000);
    return 0;
  } catch { return 0; }
}
