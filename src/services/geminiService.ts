/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Vehicle, Driver, Trip, Expenses, AIAnalysis } from '../types.ts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
You are ProfitScan AI, an intelligent logistics analyst.
Your goal is to analyze trip data and provide:
1. Risk Forecast: Analyze delay probability based on season, cargo type, and route.
2. Fuel Optimization: Recommend regions or strategies for cheaper refueling.
3. Negotiation Advice: Provide a persuasive argument for a dispatcher to raise the freight rate based on the numbers.

Return the response in JSON format with the following structure:
{
  "riskForecast": "string",
  "fuelOptimization": "string",
  "negotiationAdvice": "string",
  "summary": "string"
}
`;

export async function analyzeTrip(
  trip: Trip,
  vehicle: Vehicle,
  driver: Driver,
  expenses: Expenses,
  margin: number,
  language: string
): Promise<AIAnalysis> {
  const languageName = language === 'ru' ? 'Russian' : 'English';
  const prompt = `
  Analyze the following trip and provide your response in ${languageName}:
  - Route: ${trip.origin} to ${trip.destination}
  - Distance: ${trip.plannedDistance} km
  - Cargo: ${trip.cargoType}
  - Load Level: ${trip.loadLevel}%
  - Season: ${trip.season}
  - Vehicle: ${vehicle.model}
  - Freight Rate: ${trip.freightRate} RUB
  - Current Margin: ${margin.toFixed(2)}%
  - Fuel Price: ${expenses.fuelPrice} RUB/L
  - Toll Roads: ${expenses.tollRoads} RUB
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          riskForecast: { type: Type.STRING },
          fuelOptimization: { type: Type.STRING },
          negotiationAdvice: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["riskForecast", "fuelOptimization", "negotiationAdvice", "summary"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function getDistance(origin: string, destination: string): Promise<number> {
  const prompt = `Calculate the driving distance in kilometers between ${origin} and ${destination}. Return ONLY the number. For example: 710`;
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  const distanceText = response.text.replace(/[^0-9.]/g, '');
  const distance = parseFloat(distanceText);
  return isNaN(distance) ? 0 : distance;
}
