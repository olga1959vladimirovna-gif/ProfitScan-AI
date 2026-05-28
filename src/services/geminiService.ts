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

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-
