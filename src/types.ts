/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Vehicle {
  id: string;
  model: string;
  plate: string;
  fuelConsumptionEmpty: number; // L/100km
  fuelConsumptionLoaded: number; // L/100km
  amortizationPerKm: number; // RUB/km
}

export interface Driver {
  id: string;
  name: string;
  dailyAllowance: number; // RUB/day
  ratePerKm?: number; // RUB/km
  ratePercentage?: number; // % of freight
  fixedSalary?: number; // Fixed amount per trip in RUB
}

export type Currency = 'RUB' | 'EUR' | 'USD';

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  plannedDistance: number; // km
  actualDistance?: number; // km
  freightRate: number; // total or per km
  isRatePerKm: boolean; // toggle for rate calculation
  currency: Currency;
  paymentType: 'VAT' | 'NO_VAT'; // С НДС / Без НДС
  vehicleId: string;
  driverId: string;
  secondDriverId?: string;
  cargoType: string;
  loadLevel: number; // 0 to 100 percentage
  season: 'winter' | 'spring' | 'summer' | 'autumn';
}

export interface Expenses {
  fuelPrice: number; // in selected currency
  tollRoads: number; // in selected currency
  unforeseen: number; // in selected currency
}

export interface ExchangeRates {
  EUR: number; // 1 EUR in RUB
  USD: number; // 1 USD in RUB
}

export interface CalculationResult {
  netProfit: number;
  marginPercentage: number;
  breakEvenRate: number;
  currency: Currency;
  netProfitRUB: number;
  breakEvenRateRUB: number;
  totalExpenses: {
    fuel: number;
    driverSalary: number;
    tollRoads: number;
    amortization: number;
    taxes: number;
    unforeseen: number;
    totalSum: number;
    fuelRUB: number;
    driverSalaryRUB: number;
    tollRoadsRUB: number;
    amortizationRUB: number;
    taxesRUB: number;
    unforeseenRUB: number;
    totalSumRUB: number;
  };
}

export interface AIAnalysis {
  riskForecast: string;
  fuelOptimization: string;
  negotiationAdvice: string;
  summary: string;
}
