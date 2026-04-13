/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Vehicle, Driver, Trip, Expenses, CalculationResult, ExchangeRates } from '../types.ts';

export function calculateTripMargin(
  trip: Trip,
  vehicle: Vehicle,
  driver: Driver,
  expenses: Expenses,
  rates: ExchangeRates,
  secondDriver?: Driver
): CalculationResult {
  const distance = trip.actualDistance || trip.plannedDistance;
  
  // Conversion helper: RUB to selected currency
  const toSelected = (rubAmount: number) => {
    if (trip.currency === 'RUB') return rubAmount;
    const rate = rates[trip.currency as keyof ExchangeRates];
    return rubAmount / rate;
  };

  // Conversion helper: Selected currency to RUB
  const toRUB = (amount: number) => {
    if (trip.currency === 'RUB') return amount;
    const rate = rates[trip.currency as keyof ExchangeRates];
    return amount * rate;
  };

  // 1. Fuel Expenses (already in selected currency)
  const emptyCons = vehicle.fuelConsumptionEmpty;
  const loadedCons = vehicle.fuelConsumptionLoaded;
  const actualConsPer100 = emptyCons + (loadedCons - emptyCons) * (trip.loadLevel / 100);
  
  const fuelConsumption = (distance / 100) * actualConsPer100;
  const fuelCost = fuelConsumption * expenses.fuelPrice;
  const fuelCostRUB = toRUB(fuelCost);

  // 2. Driver Salary (defined in RUB)
  const calculateSalaryRUB = (d: Driver) => {
    let salary = 0;
    if (d.fixedSalary) {
      salary = d.fixedSalary;
    } else if (d.ratePerKm) {
      salary = distance * d.ratePerKm;
    } else if (d.ratePercentage) {
      // Percentage of freight rate (freight rate is in selected currency, convert to RUB first)
      const currentFreight = trip.isRatePerKm ? trip.freightRate * distance : trip.freightRate;
      const freightRUB = toRUB(currentFreight);
      salary = (freightRUB * d.ratePercentage) / 100;
    }
    const estimatedDays = Math.ceil(distance / 500);
    salary += estimatedDays * d.dailyAllowance;
    return salary;
  };

  let driverSalaryRUB = calculateSalaryRUB(driver);
  if (secondDriver) {
    driverSalaryRUB += calculateSalaryRUB(secondDriver);
  }
  const driverSalary = toSelected(driverSalaryRUB);

  // 3. Amortization (defined in RUB)
  const amortizationRUB = distance * vehicle.amortizationPerKm;
  const amortization = toSelected(amortizationRUB);

  // 4. Taxes (on freight rate, which is in selected currency)
  const currentFreight = trip.isRatePerKm ? trip.freightRate * distance : trip.freightRate;
  const taxRate = trip.paymentType === 'VAT' ? 0.20 : 0.06;
  const taxes = currentFreight * taxRate;
  const taxesRUB = toRUB(taxes);

  // 5. Total Expenses (all in selected currency)
  const tollRoadsRUB = toRUB(expenses.tollRoads);
  const unforeseenRUB = toRUB(expenses.unforeseen);
  
  const totalExpensesSum = fuelCost + driverSalary + expenses.tollRoads + amortization + taxes + expenses.unforeseen;
  const totalExpensesSumRUB = fuelCostRUB + driverSalaryRUB + tollRoadsRUB + amortizationRUB + taxesRUB + unforeseenRUB;

  // 6. Net Profit
  const netProfit = currentFreight - totalExpensesSum;
  const netProfitRUB = toRUB(currentFreight) - totalExpensesSumRUB;

  // 7. Margin %
  const marginPercentage = (netProfit / currentFreight) * 100;

  // 8. Break-even Rate
  const otherExpenses = fuelCost + driverSalary + expenses.tollRoads + amortization + expenses.unforeseen;
  const breakEvenRate = otherExpenses / (1 - taxRate);
  const breakEvenRateRUB = toRUB(breakEvenRate);

  return {
    netProfit,
    marginPercentage,
    breakEvenRate,
    currency: trip.currency,
    netProfitRUB,
    breakEvenRateRUB,
    totalExpenses: {
      fuel: fuelCost,
      driverSalary,
      tollRoads: expenses.tollRoads,
      amortization,
      taxes,
      unforeseen: expenses.unforeseen,
      totalSum: totalExpensesSum,
      fuelRUB: fuelCostRUB,
      driverSalaryRUB,
      tollRoadsRUB,
      amortizationRUB,
      taxesRUB,
      unforeseenRUB,
      totalSumRUB: totalExpensesSumRUB,
    },
  };
}
