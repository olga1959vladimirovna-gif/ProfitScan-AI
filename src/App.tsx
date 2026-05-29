/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  User, 
  MapPin, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  FileText, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  Trash2, 
  Info,
  Zap,
  Fuel,
  TrendingUp,
  MessageSquare,
  Download,
  Share2,
  Globe,
  Calculator,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vehicle, Driver, Trip, Expenses, CalculationResult, AIAnalysis, Currency, ExchangeRates } from './types.ts';
import { calculateTripMargin } from './lib/calculations.ts';
import { analyzeTrip, getDistance } from './services/geminiService.ts';
import { Language, translations } from './lib/translations.ts';

// Mock Data
const MOCK_VEHICLES: Vehicle[] = [
  { id: 'v1', model: 'Volvo FH16', plate: 'A123BC77', fuelConsumptionEmpty: 25, fuelConsumptionLoaded: 32, amortizationPerKm: 5 },
  { id: 'v2', model: 'Scania R450', plate: 'B456DE99', fuelConsumptionEmpty: 24, fuelConsumptionLoaded: 30, amortizationPerKm: 4.5 },
  { id: 'v3', model: 'KAMAZ Neo', plate: 'C789FG16', fuelConsumptionEmpty: 28, fuelConsumptionLoaded: 35, amortizationPerKm: 3.5 },
];

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Иван Петров', dailyAllowance: 1000, ratePerKm: 8 },
  { id: 'd2', name: 'Сергей Сидоров', dailyAllowance: 1200, ratePercentage: 15 },
];

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <div 
      className="relative inline-flex items-center" 
      onMouseEnter={() => setIsVisible(true)} 
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(!isVisible)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 p-3 bg-neutral-900 text-white text-[11px] leading-relaxed rounded-xl shadow-2xl pointer-events-none font-normal normal-case"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-neutral-900" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [language, setLanguage] = useState<Language>('ru');
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'calculator' | 'spec'>('calculator');
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle>(MOCK_VEHICLES[0]);
  const [selectedDriver, setSelectedDriver] = useState<Driver>(MOCK_DRIVERS[0]);
  const [selectedSecondDriver, setSelectedSecondDriver] = useState<Driver | null>(null);
  const [isDoubleCrew, setIsDoubleCrew] = useState(false);
  const [isInternational, setIsInternational] = useState(false);

  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ model: '', plate: '' });
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', fixedSalary: 0 });

  const [trip, setTrip] = useState<Trip>({
    id: 't1',
    origin: 'Москва',
    destination: 'Санкт-Петербург',
    plannedDistance: 700,
    freightRate: 80000,
    isRatePerKm: false,
    currency: 'RUB',
    paymentType: 'NO_VAT',
    vehicleId: MOCK_VEHICLES[0].id,
    driverId: MOCK_DRIVERS[0].id,
    cargoType: 'Оборудование',
    loadLevel: 100,
    season: 'spring',
  });
  const [expenses, setExpenses] = useState<Expenses>({
    fuelPrice: 60,
    tollRoads: 2500,
    unforeseen: 1000,
  });
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const [rates, setRates] = useState<ExchangeRates>({
    EUR: 100,
    USD: 92,
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingDistance, setIsFetchingDistance] = useState(false);

  const handleCurrencyChange = (newCurr: Currency) => {
    if (newCurr === trip.currency) {
      setIsInternational(newCurr !== 'RUB');
      return;
    }
    
    const oldCurr = trip.currency;
    const toRUB = (val: number, curr: Currency) => {
      if (curr === 'RUB') return val;
      return val * rates[curr as keyof ExchangeRates];
    };
    const fromRUB = (val: number, curr: Currency) => {
      if (curr === 'RUB') return val;
      const rate = rates[curr as keyof ExchangeRates];
      return rate > 0 ? val / rate : 0;
    };

    // If switching from RUB to International, or vice versa, we might want to use "sensible" defaults
    // instead of just converting, especially for fuel.
    // But for now, let's stick to conversion to preserve user input, 
    // but ensure it's actually happening.
    
    const fuelPriceRUB = toRUB(expenses.fuelPrice, oldCurr);
    const tollRoadsRUB = toRUB(expenses.tollRoads, oldCurr);
    const unforeseenRUB = toRUB(expenses.unforeseen, oldCurr);
    const freightRateRUB = toRUB(trip.freightRate, oldCurr);

    const newFuelPrice = fromRUB(fuelPriceRUB, newCurr);
    const newTollRoads = fromRUB(tollRoadsRUB, newCurr);
    const newUnforeseen = fromRUB(unforeseenRUB, newCurr);
    const newFreightRate = fromRUB(freightRateRUB, newCurr);

    setIsInternational(newCurr !== 'RUB');
    setExpenses({
      fuelPrice: Number(newFuelPrice.toFixed(2)),
      tollRoads: Number(newTollRoads.toFixed(2)),
      unforeseen: Number(newUnforeseen.toFixed(2)),
    });
    setTrip(prev => ({ 
      ...prev, 
      currency: newCurr, 
      freightRate: Number(newFreightRate.toFixed(2)) 
    }));
  };

  const handleCalculate = () => {
    const res = calculateTripMargin(trip, selectedVehicle, selectedDriver, expenses, rates, isDoubleCrew ? selectedSecondDriver || undefined : undefined);
    setResult(res);
  };

  const handleAddVehicle = () => {
    if (!newVehicle.model || !newVehicle.plate) return;
    const vehicle: Vehicle = {
      id: `v-${Date.now()}`,
      model: newVehicle.model,
      plate: newVehicle.plate,
      fuelConsumptionEmpty: 25, // default
      fuelConsumptionLoaded: 32, // default
      amortizationPerKm: 5, // default
    };
    setVehicles([...vehicles, vehicle]);
    setSelectedVehicle(vehicle);
    setIsAddingVehicle(false);
    setNewVehicle({ model: '', plate: '' });
  };

  const handleAddDriver = () => {
    if (!newDriver.name) return;
    const driver: Driver = {
      id: `d-${Date.now()}`,
      name: newDriver.name,
      dailyAllowance: 1000, // default
      fixedSalary: newDriver.fixedSalary > 0 ? newDriver.fixedSalary : undefined,
      ratePerKm: newDriver.fixedSalary > 0 ? undefined : 8, // default if not fixed
    };
    setDrivers([...drivers, driver]);
    setSelectedDriver(driver);
    setIsAddingDriver(false);
    setNewDriver({ name: '', fixedSalary: 0 });
  };

  const handleFetchDistance = async () => {
    if (!trip.origin || !trip.destination) return;
    setIsFetchingDistance(true);
    try {
      const distance = await getDistance(trip.origin, trip.destination);
      if (distance > 0) {
        setTrip(prev => ({ ...prev, plannedDistance: distance }));
      }
    } catch (error) {
      console.error('Failed to fetch distance:', error);
    } finally {
      setIsFetchingDistance(false);
    }
  };

  const getCurrencySymbol = (curr: Currency) => {
    switch (curr) {
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return '₽';
    }
  };

  const formatCurrency = (val: number, curr: Currency = trip.currency) => {
    return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDualCurrency = (val: number, valRUB: number, curr: Currency) => {
    if (curr === 'RUB') return formatCurrency(val, 'RUB');
    return (
      <div className="flex flex-col items-end">
        <span className="font-bold">{formatCurrency(val, curr)}</span>
        <span className="text-[10px] opacity-60 font-medium">≈ {formatCurrency(valRUB, 'RUB')}</span>
      </div>
    );
  };

  useEffect(() => {
    handleCalculate();
  }, [trip, expenses, rates, isDoubleCrew, selectedVehicle, selectedDriver, selectedSecondDriver]);
  
useEffect(() => {
    setAnalysis(null);
  }, [language]);
  
 const handleGenerateReport = async () => {
    if (!result) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    try {
      const aiRes = await analyzeTrip(trip, selectedVehicle, selectedDriver, expenses, result.marginPercentage, language);
      setAnalysis(aiRes);
    } catch (error) {
      console.error('AI Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getTrafficLightColor = (margin: number) => {
    if (margin > 15) return 'text-green-500 bg-green-50 border-green-200';
    if (margin > 5) return 'text-yellow-500 bg-yellow-50 border-yellow-200';
    return 'text-red-500 bg-red-50 border-red-200';
  };

  const getTrafficLightIcon = (margin: number) => {
    if (margin > 15) return <CheckCircle className="w-8 h-8" />;
    if (margin > 5) return <AlertTriangle className="w-8 h-8" />;
    return <XCircle className="w-8 h-8" />;
  };

  const handleExportCSV = () => {
    if (!result) return;
    const headers = t.csvHeaders;
    const data = [
      trip.origin, trip.destination, trip.plannedDistance, trip.freightRate, trip.paymentType,
      selectedVehicle.model, selectedDriver.name, 
      Math.round(result.totalExpenses.fuel), Math.round(result.totalExpenses.driverSalary), 
      Math.round(result.totalExpenses.amortization), Math.round(result.totalExpenses.taxes),
      Math.round(result.totalExpenses.tollRoads), Math.round(result.totalExpenses.unforeseen), 
      Math.round(result.totalExpenses.totalSum),
      Math.round(result.netProfit), result.marginPercentage.toFixed(2)
    ];

    const csvContent = [headers.join(','), data.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `profitscan_report_${trip.origin}_${trip.destination}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportReport = () => {
    if (!result) return;
    const isIntl = trip.currency !== 'RUB';
    const report = `
${t.reportTitle}: ${trip.origin} -> ${trip.destination}
--------------------------------------------------
${t.reportParams}:
${t.distance}: ${trip.plannedDistance} км
${t.rate}: ${formatCurrency(trip.freightRate, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(trip.freightRate * rates[trip.currency as keyof ExchangeRates], 'RUB')})` : ''}
${t.paymentType}: ${trip.paymentType === 'VAT' ? t.vat : t.noVat}
${t.calculator}: ${selectedVehicle.model} (${selectedVehicle.plate})
${t.driver}: ${selectedDriver.name}

${t.reportExpenses}:
${t.fuel}: ${formatCurrency(result.totalExpenses.fuel, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.fuelRUB, 'RUB')})` : ''}
${t.driverSalary}: ${formatCurrency(result.totalExpenses.driverSalary, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.driverSalaryRUB, 'RUB')})` : ''}
${t.amortization}: ${formatCurrency(result.totalExpenses.amortization, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.amortizationRUB, 'RUB')})` : ''}
${t.taxes}: ${formatCurrency(result.totalExpenses.taxes, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.taxesRUB, 'RUB')})` : ''}
${t.tollRoads}: ${formatCurrency(result.totalExpenses.tollRoads, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.tollRoadsRUB, 'RUB')})` : ''}
${t.unforeseenExpenses}: ${formatCurrency(result.totalExpenses.unforeseen, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.unforeseenRUB, 'RUB')})` : ''}
${t.total}: ${formatCurrency(result.totalExpenses.totalSum, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.totalExpenses.totalSumRUB, 'RUB')})` : ''}

${t.reportResults}:
${t.netProfit}: ${formatCurrency(result.netProfit, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.netProfitRUB, 'RUB')})` : ''}
${t.margin}: ${result.marginPercentage.toFixed(2)}%
${t.breakEven}: ${formatCurrency(result.breakEvenRate, trip.currency)}${isIntl ? ` (≈ ${formatCurrency(result.breakEvenRateRUB, 'RUB')})` : ''}
--------------------------------------------------
${t.reportGenerated}
    `;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `profitscan_report_${trip.origin}_${trip.destination}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-neutral-900 p-2.5 rounded-2xl shadow-xl shadow-neutral-200">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic leading-none">{t.appName}</h1>
              <span className="text-[10px] font-bold text-neutral-400 tracking-widest uppercase">Fleet Intelligence</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-neutral-100/50 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'calculator' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              {t.calculator}
            </button>
            <button 
              onClick={() => setActiveTab('spec')}
              className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'spec' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              {t.specification}
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <span className={language === 'ru' ? 'text-orange-600' : 'text-neutral-400'}>RU</span>
              <div className="w-px h-3 bg-neutral-200"></div>
              <span className={language === 'en' ? 'text-orange-600' : 'text-neutral-400'}>EN</span>
            </button>
            <Tooltip text={t.aiStatusHint}>
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-white border border-neutral-200 rounded-xl group cursor-help shadow-sm">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  whileHover={{ 
                    scale: 2,
                    opacity: 1,
                    boxShadow: "0 0 20px rgba(34,197,94,0.4)"
                  }}
                  className="w-2.5 h-2.5 bg-green-500 rounded-full"
                />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-neutral-600 transition-colors">Live AI</span>
              </div>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {activeTab === 'calculator' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Input Form */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white p-8 rounded-5xl shadow-sm border border-neutral-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 opacity-50 blur-3xl" />
                <h2 className="text-xl font-black mb-6 flex items-center gap-3 italic uppercase tracking-tight">
                  <div className="bg-orange-100 p-2 rounded-xl">
                    <Truck className="w-5 h-5 text-orange-600" />
                  </div>
                  {t.vehicleAndDriver}
                </h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-caps">
                        {t.selectVehicle}
                      </label>
                      <button 
                        onClick={() => setIsAddingVehicle(!isAddingVehicle)}
                        className="p-1.5 hover:bg-neutral-50 rounded-xl text-orange-600 transition-all border border-transparent hover:border-neutral-100"
                      >
                        <Plus className={`w-4 h-4 transition-transform ${isAddingVehicle ? 'rotate-45' : ''}`} />
                      </button>
                    </div>
                    
                    {isAddingVehicle ? (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-neutral-50 border border-neutral-100 rounded-3xl space-y-4 mb-4"
                      >
                        <input 
                          type="text" 
                          placeholder={t.vehicleModelLabel}
                          value={newVehicle.model}
                          onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                          className="input-field"
                        />
                        <input 
                          type="text" 
                          placeholder={t.vehiclePlateLabel}
                          value={newVehicle.plate}
                          onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value})}
                          className="input-field"
                        />
                        <div className="flex gap-3">
                          <button 
                            onClick={handleAddVehicle}
                            className="btn-primary flex-1 py-2.5"
                          >
                            {t.save}
                          </button>
                          <button 
                            onClick={() => setIsAddingVehicle(false)}
                            className="btn-secondary flex-1 py-2.5"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <select 
                        value={selectedVehicle.id}
                        onChange={(e) => setSelectedVehicle(vehicles.find(v => v.id === e.target.value)!)}
                        className="input-field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
                      >
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.model} ({v.plate})</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-caps">
                        {t.driver}
                      </label>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            setIsDoubleCrew(!isDoubleCrew);
                            if (!isDoubleCrew && !selectedSecondDriver) {
                              setSelectedSecondDriver(drivers[1] || drivers[0]);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${isDoubleCrew ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-white border-neutral-200 text-neutral-400'}`}
                        >
                          {t.doubleCrew}
                        </button>
                        <button 
                          onClick={() => setIsAddingDriver(!isAddingDriver)}
                          className="p-1.5 hover:bg-neutral-50 rounded-xl text-orange-600 transition-all border border-transparent hover:border-neutral-100"
                        >
                          <Plus className={`w-4 h-4 transition-transform ${isAddingDriver ? 'rotate-45' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isAddingDriver ? (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 bg-neutral-50 border border-neutral-100 rounded-3xl space-y-4"
                      >
                        <input 
                          type="text" 
                          placeholder={t.driverNameLabel}
                          value={newDriver.name}
                          onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                          className="input-field"
                        />
                        <input 
                          type="number" 
                          placeholder={t.fixedSalaryLabel}
                          value={newDriver.fixedSalary || ''}
                          onChange={(e) => setNewDriver({...newDriver, fixedSalary: Number(e.target.value)})}
                          className="input-field"
                        />
                        <div className="flex gap-3">
                          <button 
                            onClick={handleAddDriver}
                            className="btn-primary flex-1 py-2.5"
                          >
                            {t.save}
                          </button>
                          <button 
                            onClick={() => setIsAddingDriver(false)}
                            className="btn-secondary flex-1 py-2.5"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="space-y-3">
                        <select 
                          value={selectedDriver.id}
                          onChange={(e) => setSelectedDriver(drivers.find(d => d.id === e.target.value)!)}
                          className="input-field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
                        >
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} {d.fixedSalary ? `(Фикс: ${d.fixedSalary} ₽)` : d.ratePerKm ? `(${d.ratePerKm} ₽/км)` : `(${d.ratePercentage}%)`}
                            </option>
                          ))}
                        </select>
                        
                        {isDoubleCrew && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-2"
                          >
                            <label className="label-caps ml-1">
                              {t.secondDriver}
                            </label>
                            <select 
                              value={selectedSecondDriver?.id || ''}
                              onChange={(e) => setSelectedSecondDriver(drivers.find(d => d.id === e.target.value) || null)}
                              className="input-field appearance-none bg-orange-50/30 border-orange-100 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
                            >
                              {drivers.map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.name} {d.fixedSalary ? `(Фикс: ${d.fixedSalary} ₽)` : d.ratePerKm ? `(${d.ratePerKm} ₽/км)` : `(${d.ratePercentage}%)`}
                                </option>
                              ))}
                            </select>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-white p-8 rounded-5xl shadow-sm border border-neutral-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50 blur-3xl" />
                <h2 className="text-xl font-black mb-6 flex items-center justify-between gap-3 italic uppercase tracking-tight">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-xl">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    {t.tripParams}
                  </div>
                  <button 
                    onClick={() => {
                      const newValue = !isInternational;
                      setIsInternational(newValue);
                      if (newValue && trip.currency === 'RUB') {
                        handleCurrencyChange('EUR');
                      } else if (!newValue && trip.currency !== 'RUB') {
                        handleCurrencyChange('RUB');
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isInternational ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-neutral-200 text-neutral-400'}`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {t.internationalTrip}
                  </button>
                </h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="label-caps">{t.origin}</label>
                      <input 
                        type="text" 
                        value={trip.origin}
                        placeholder={t.originPlaceholder}
                        onChange={(e) => setTrip({...trip, origin: e.target.value})}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label-caps">{t.destination}</label>
                      <input 
                        type="text" 
                        value={trip.destination}
                        placeholder={t.destinationPlaceholder}
                        onChange={(e) => setTrip({...trip, destination: e.target.value})}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="label-caps">{t.distance}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={trip.plannedDistance}
                          onChange={(e) => setTrip({...trip, plannedDistance: Number(e.target.value)})}
                          className="input-field pr-12"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-300 uppercase tracking-widest">км</span>
                      </div>
                      <button 
                        onClick={handleFetchDistance}
                        disabled={isFetchingDistance || !trip.origin || !trip.destination}
                        className="mt-3 w-full py-3 bg-neutral-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-neutral-800 shadow-lg shadow-neutral-100"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isFetchingDistance ? 'animate-pulse' : ''}`} />
                        {t.getDistance}
                      </button>
                    </div>
                    <div>
                      <label className="label-caps">{t.currency}</label>
                      <select 
                        value={trip.currency}
                        onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
                        className="input-field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.75rem_center] bg-no-repeat"
                      >
                        <option value="RUB">RUB (₽)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-caps">
                        {trip.isRatePerKm ? t.ratePerKm : t.rate}
                      </label>
                      <div className="flex bg-neutral-100/50 p-1 rounded-xl">
                        <button 
                          onClick={() => setTrip({...trip, isRatePerKm: false})}
                          className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${!trip.isRatePerKm ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400'}`}
                        >
                          {t.total}
                        </button>
                        <button 
                          onClick={() => setTrip({...trip, isRatePerKm: true})}
                          className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${trip.isRatePerKm ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400'}`}
                        >
                          /км
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={trip.freightRate}
                        onChange={(e) => setTrip({...trip, freightRate: Number(e.target.value)})}
                        className="input-field pr-12 text-lg font-black"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-black text-neutral-300">{getCurrencySymbol(trip.currency)}</span>
                    </div>
                    {trip.isRatePerKm && (
                      <div className="mt-2 text-[10px] text-neutral-400 font-black uppercase tracking-widest text-right">
                        {t.totalRate}: {formatCurrency(trip.freightRate * (trip.actualDistance || trip.plannedDistance), trip.currency)}
                      </div>
                    )}
                  </div>

                  {trip.currency !== 'RUB' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-5 bg-blue-50/50 border border-blue-100 rounded-3xl"
                    >
                      <label className="label-caps text-blue-600">{t.exchangeRate}</label>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-blue-800">1 {trip.currency} =</span>
                        <input 
                          type="number" 
                          value={rates[trip.currency as keyof ExchangeRates]}
                          onChange={(e) => setRates({...rates, [trip.currency]: Number(e.target.value)})}
                          className="w-24 bg-white border border-blue-200 rounded-xl px-3 py-2 text-sm font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <span className="text-sm font-black text-blue-800">₽</span>
                      </div>
                    </motion.div>
                  )}
                  <div>
                    <label className="label-caps">{t.paymentType}</label>
                    <div className="flex gap-3 p-1.5 bg-neutral-100/50 rounded-2xl">
                      <button 
                        onClick={() => setTrip({...trip, paymentType: 'VAT'})}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${trip.paymentType === 'VAT' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'}`}
                      >
                        {t.vat}
                      </button>
                      <button 
                        onClick={() => setTrip({...trip, paymentType: 'NO_VAT'})}
                        className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${trip.paymentType === 'NO_VAT' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'}`}
                      >
                        {t.noVat}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="label-caps flex items-center gap-1.5">
                        {t.loadLevel}
                        <Tooltip text={t.loadHint}>
                          <Info className="w-3 h-3 text-neutral-300 cursor-help" />
                        </Tooltip>
                      </label>
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{trip.loadLevel}%</span>
                    </div>
                    <div className="flex gap-2 p-1.5 bg-neutral-100/50 rounded-2xl">
                      <button 
                        onClick={() => setTrip({...trip, loadLevel: 0})}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${trip.loadLevel === 0 ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
                      >
                        {t.loadEmpty}
                      </button>
                      <button 
                        onClick={() => setTrip({...trip, loadLevel: 50})}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${trip.loadLevel === 50 ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
                      >
                        {t.loadPartial}
                      </button>
                      <button 
                        onClick={() => setTrip({...trip, loadLevel: 100})}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${trip.loadLevel === 100 ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
                      >
                        {t.loadFull}
                      </button>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      value={trip.loadLevel}
                      onChange={(e) => setTrip({...trip, loadLevel: Number(e.target.value)})}
                      className="w-full mt-4 accent-orange-600 h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </section>

              <section className="bg-white p-8 rounded-5xl shadow-sm border border-neutral-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 opacity-50 blur-3xl" />
                <h2 className="text-xl font-black mb-6 flex items-center gap-3 italic uppercase tracking-tight">
                  <div className="bg-green-100 p-2 rounded-xl">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  {t.expenses}
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="label-caps">{t.fuelPrice} ({getCurrencySymbol(trip.currency)}/л)</label>
                    <input 
                      type="number" 
                      value={expenses.fuelPrice}
                      onChange={(e) => setExpenses({...expenses, fuelPrice: Number(e.target.value)})}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-caps">{t.tollRoads} ({getCurrencySymbol(trip.currency)})</label>
                    <input 
                      type="number" 
                      value={expenses.tollRoads}
                      onChange={(e) => setExpenses({...expenses, tollRoads: Number(e.target.value)})}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-caps">{t.unforeseenExpenses} ({getCurrencySymbol(trip.currency)})</label>
                    <input 
                      type="number" 
                      value={expenses.unforeseen}
                      onChange={(e) => setExpenses({...expenses, unforeseen: Number(e.target.value)})}
                      className="input-field"
                    />
                  </div>
                </div>
              </section>

              <div className="mt-8">
                <button 
                  onClick={handleCalculate}
                  className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-6 h-6" />
                  {t.calculate}
                </button>
              </div>
            </div>

            {/* Results Dashboard */}
            <div className="lg:col-span-8 space-y-8">
              {result && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`md:col-span-2 p-10 rounded-[3rem] border-0 relative overflow-hidden flex flex-col justify-between shadow-2xl ${
                      result.marginPercentage > 15 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-green-200/50' 
                        : result.marginPercentage > 5 
                          ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-orange-200/50' 
                          : 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-200/50'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full -ml-24 -mb-24 blur-2xl" />
                    
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          {t.netProfit}
                          <Tooltip text={t.netProfitTooltip}>
                            <div className="p-1 -m-1 cursor-help opacity-60 hover:opacity-100 transition-opacity">
                              <Info className="w-3.5 h-3.5" />
                            </div>
                          </Tooltip>
                        </p>
                        <div className="flex flex-col">
                          <h3 className="text-6xl font-black tracking-tighter leading-none">{formatCurrency(result.netProfit, trip.currency)}</h3>
                          {trip.currency !== 'RUB' && (
                            <span className="text-xl font-bold opacity-70 mt-1">≈ {formatCurrency(result.netProfitRUB, 'RUB')}</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md border border-white/20">
                        {getTrafficLightIcon(result.marginPercentage)}
                      </div>
                    </div>

                    <div className="relative z-10 mt-12 grid grid-cols-2 gap-8">
                      <div className="bg-white/10 p-5 rounded-[2rem] backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 flex items-center gap-1.5 mb-2">
                          {t.margin}
                          <Tooltip text={t.marginTooltip}>
                            <div className="p-1 -m-1 cursor-help opacity-60">
                              <Info className="w-3 h-3" />
                            </div>
                          </Tooltip>
                        </p>
                        <p className="text-3xl font-black tracking-tight">{result.marginPercentage.toFixed(1)}%</p>
                      </div>
                      <div className="bg-white/10 p-5 rounded-[2rem] backdrop-blur-sm border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 flex items-center gap-1.5 mb-2">
                          {t.breakEven}
                          <Tooltip text={t.breakEvenTooltip}>
                            <div className="p-1 -m-1 cursor-help opacity-60">
                              <Info className="w-3 h-3" />
                            </div>
                          </Tooltip>
                        </p>
                        <div className="flex flex-col">
                          <p className="text-xl font-black tracking-tight">{formatCurrency(result.breakEvenRate, trip.currency)}</p>
                          {trip.currency !== 'RUB' && (
                            <span className="text-[10px] font-bold opacity-60">≈ {formatCurrency(result.breakEvenRateRUB, 'RUB')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm flex flex-col">
                    <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      {t.expenseStructure}
                    </h4>
                    <div className="space-y-4 flex-1">
                      {[
                        { label: t.fuel, val: result.totalExpenses.fuel, rub: result.totalExpenses.fuelRUB, icon: <Fuel className="w-3.5 h-3.5" /> },
                        { label: t.driverSalary, val: result.totalExpenses.driverSalary, rub: result.totalExpenses.driverSalaryRUB, icon: <User className="w-3.5 h-3.5" /> },
                        { label: t.amortization, val: result.totalExpenses.amortization, rub: result.totalExpenses.amortizationRUB, icon: <Truck className="w-3.5 h-3.5" /> },
                        { label: t.taxes, val: result.totalExpenses.taxes, rub: result.totalExpenses.taxesRUB, icon: <FileText className="w-3.5 h-3.5" /> },
                        { label: t.tollRoads, val: result.totalExpenses.tollRoads, rub: result.totalExpenses.tollRoadsRUB, icon: <MapPin className="w-3.5 h-3.5" /> },
                        { label: t.unforeseenExpenses, val: result.totalExpenses.unforeseen, rub: result.totalExpenses.unforeseenRUB, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                              {item.icon}
                            </div>
                            <span className="text-xs font-bold text-neutral-500">{item.label}</span>
                          </div>
                          {formatDualCurrency(item.val, item.rub, trip.currency)}
                        </div>
                      ))}
                    </div>
                    <div className="mt-8 pt-6 border-t border-neutral-100 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-neutral-900">{t.total}</span>
                      <div className="text-orange-600">
                        {formatDualCurrency(result.totalExpenses.totalSum, result.totalExpenses.totalSumRUB, trip.currency)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Section */}
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <h2 className="text-2xl font-black italic uppercase tracking-tight flex items-center gap-3">
                    <div className="bg-neutral-900 p-2 rounded-xl">
                      <Zap className="w-5 h-5 text-white fill-current" />
                    </div>
                    {t.aiAnalytics}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={handleExportCSV}
                      className="btn-secondary px-5 py-2.5 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">CSV</span>
                    </button>
                    <button 
                      onClick={handleExportReport}
                      className="btn-secondary px-5 py-2.5 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{t.exportReport}</span>
                    </button>
                    <button 
                      onClick={handleGenerateReport}
                      disabled={isAnalyzing}
                      className="btn-primary px-8 py-2.5 flex items-center gap-3 shadow-xl shadow-orange-100"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{t.analyzing}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{t.aiAnalysis}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div 
                      key="analysis"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                      {[
                        { title: t.riskForecast, desc: analysis.riskForecast, icon: <AlertTriangle className="text-blue-600 w-5 h-5" />, bg: 'bg-blue-50' },
                        { title: t.fuelOptimization, desc: analysis.fuelOptimization, icon: <Fuel className="text-green-600 w-5 h-5" />, bg: 'bg-green-50' },
                        { title: t.negotiationAdvice, desc: analysis.negotiationAdvice, icon: <MessageSquare className="text-purple-600 w-5 h-5" />, bg: 'bg-purple-50', italic: true },
                      ].map((card, idx) => (
                        <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
                          <div className={`${card.bg} w-12 h-12 rounded-2xl flex items-center justify-center mb-6`}>
                            {card.icon}
                          </div>
                          <h4 className="text-sm font-black uppercase tracking-widest mb-3 text-neutral-900">{card.title}</h4>
                          <p className={`text-sm text-neutral-500 leading-relaxed ${card.italic ? 'italic font-medium' : ''}`}>{card.desc}</p>
                        </div>
                      ))}
                      
                      <div className="md:col-span-3 bg-neutral-900 text-white p-10 rounded-[3rem] relative overflow-hidden shadow-2xl shadow-neutral-200">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                        <div className="relative z-10">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="bg-orange-500 p-2.5 rounded-xl">
                              <FileText className="text-white w-5 h-5" />
                            </div>
                            <h4 className="text-xl font-black italic uppercase tracking-tight">{t.finalSummary}</h4>
                          </div>
                          <p className="text-neutral-400 leading-relaxed mb-8 whitespace-pre-wrap text-lg font-medium">{analysis.summary}</p>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(analysis.summary);
                              // Using a custom toast would be better, but for now alert is okay if we must
                              // Actually, I'll just change the button text temporarily
                            }}
                            className="bg-white text-neutral-900 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 hover:bg-orange-500 hover:text-white group"
                          >
                            {t.copyForMessenger}
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : !isAnalyzing && (
                    <motion.div 
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-white border-2 border-dashed border-neutral-100 rounded-[3rem] p-20 text-center"
                    >
                      <div className="max-w-xs mx-auto">
                        <div className="bg-neutral-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                          <Zap className="text-neutral-200 w-10 h-10" />
                        </div>
                        <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs leading-relaxed">{t.aiPlaceholder}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* User Guide Section */}
                <div className="mt-12 bg-white rounded-[3rem] border border-neutral-100 shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="w-full p-10 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-neutral-900 p-3 rounded-2xl shadow-xl shadow-neutral-100 group-hover:scale-110 transition-transform">
                        <HelpCircle className="text-white w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight uppercase italic">{t.userGuide}</h2>
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-1">Quick Start Manual</p>
                      </div>
                    </div>
                    <div className={`w-10 h-10 rounded-full border border-neutral-100 flex items-center justify-center transition-all ${isGuideOpen ? 'bg-neutral-900 border-neutral-900' : ''}`}>
                      <ChevronDown className={`w-5 h-5 transition-transform duration-500 ${isGuideOpen ? 'rotate-180 text-white' : 'text-neutral-400'}`} />
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isGuideOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                      >
                        <div className="px-10 pb-10">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 pt-10 border-t border-neutral-50">
                            {[
                              { title: t.guideStep1Title, desc: t.guideStep1Desc, icon: <Truck className="w-4 h-4" />, num: "01" },
                              { title: t.guideStep2Title, desc: t.guideStep2Desc, icon: <MapPin className="w-4 h-4" />, num: "02" },
                              { title: t.guideStep3Title, desc: t.guideStep3Desc, icon: <TrendingUp className="w-4 h-4" />, num: "03" },
                              { title: t.guideStep4Title, desc: t.guideStep4Desc, icon: <Calculator className="w-4 h-4" />, num: "04" },
                              { title: t.guideStep5Title, desc: t.guideStep5Desc, icon: <Zap className="w-4 h-4" />, num: "05" },
                            ].map((step, idx) => (
                              <div key={idx} className="relative group">
                                <div className="absolute -top-4 -left-2 text-4xl font-black text-neutral-50 group-hover:text-orange-50 transition-colors pointer-events-none">{step.num}</div>
                                <div className="relative z-10">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="text-orange-600">{step.icon}</div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900">{step.title}</h4>
                                  </div>
                                  <p className="text-xs text-neutral-500 leading-relaxed font-medium">{step.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="bg-white p-16 rounded-[4rem] border border-neutral-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-orange-50 rounded-full -mr-48 -mt-48 opacity-50 blur-[100px]" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-neutral-900 p-4 rounded-3xl shadow-2xl">
                    <FileText className="text-white w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-5xl font-black tracking-tighter uppercase italic leading-none">{t.specTitle}</h1>
                    <p className="text-neutral-400 font-bold uppercase tracking-[0.3em] text-xs mt-2">Technical Documentation v2.0</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                  <div className="lg:col-span-7 space-y-12">
                    <section>
                      <h2 className="text-xl font-black italic uppercase tracking-tight text-orange-600 mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-orange-600 rounded-full" />
                        {t.specConceptTitle}
                      </h2>
                      <p className="text-lg text-neutral-600 leading-relaxed font-medium">
                        {t.specConceptDesc}
                      </p>
                    </section>

                    <section>
                      <h2 className="text-xl font-black italic uppercase tracking-tight text-orange-600 mb-8 flex items-center gap-3">
                        <div className="w-2 h-2 bg-orange-600 rounded-full" />
                        {t.specLogicTitle}
                      </h2>
                      <div className="bg-neutral-900 p-10 rounded-[2.5rem] font-mono text-sm space-y-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                        <div className="space-y-2">
                          <p className="text-orange-500 font-bold">// {t.netProfit}</p>
                          <p className="text-neutral-300">NetProfit = <span className="text-white">Rate - Fuel - DriverSalary - Tolls - Amortization - Taxes</span></p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-orange-500 font-bold">// {t.margin}</p>
                          <p className="text-neutral-300">Margin% = <span className="text-white">(NetProfit / Rate) * 100</span></p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-orange-500 font-bold">// {t.breakEven}</p>
                          <p className="text-neutral-300">BreakEven = <span className="text-white">(FixedExpenses) / (1 - TaxRate)</span></p>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="lg:col-span-5 space-y-8">
                    <div className="bg-neutral-50 p-10 rounded-[3rem] border border-neutral-100">
                      <h3 className="text-sm font-black uppercase tracking-widest mb-8 text-neutral-900">{t.specDataTitle}</h3>
                      <div className="space-y-8">
                        {[
                          { title: t.specVehicleRef, items: t.specVehicleItems, icon: <Truck className="w-5 h-5" /> },
                          { title: t.specDriverRef, items: t.specDriverItems, icon: <User className="w-5 h-5" /> },
                          { title: t.specTripsRef, items: t.specTripItems, icon: <MapPin className="w-5 h-5" /> },
                          { title: t.specExpensesRef, items: t.specExpenseItems, icon: <DollarSign className="w-5 h-5" /> },
                        ].map((group, idx) => (
                          <div key={idx} className="group">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="text-orange-600 group-hover:scale-110 transition-transform">{group.icon}</div>
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{group.title}</h4>
                            </div>
                            <ul className="grid grid-cols-1 gap-1.5 ml-8">
                              {group.items.map((item, i) => (
                                <li key={i} className="text-xs font-bold text-neutral-600 flex items-center gap-2">
                                  <div className="w-1 h-1 bg-neutral-300 rounded-full" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-12 rounded-[3.5rem] border border-neutral-100 shadow-sm">
                <h2 className="text-xl font-black italic uppercase tracking-tight text-orange-600 mb-6 flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-600 rounded-full" />
                  {t.specAiTitle}
                </h2>
                <p className="text-neutral-500 leading-relaxed mb-8 font-medium">{t.specAiDesc}</p>
                <div className="bg-neutral-50 p-8 rounded-3xl border border-neutral-100">
                  <pre className="text-[10px] font-mono text-neutral-400 overflow-x-auto">
{`{
  "system": "Logistics Risk Analyst",
  "input": {
    "route": "Moscow-SPB",
    "margin": "8.5%"
  },
  "output": {
    "risk": "Delay probability...",
    "fuel": "Optimization tips...",
    "advice": "Negotiation strategy..."
  }
}`}
                  </pre>
                </div>
              </div>

              <div className="bg-white p-12 rounded-[3.5rem] border border-neutral-100 shadow-sm">
                <h2 className="text-xl font-black italic uppercase tracking-tight text-orange-600 mb-8 flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-600 rounded-full" />
                  {t.specStackTitle}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: "Bubble", role: "Frontend/UI" },
                    { name: "Airtable", role: "Database" },
                    { name: "Make.com", role: "Automation" },
                    { name: "OpenAI", role: "AI Logic" },
                  ].map((tech, idx) => (
                    <div key={idx} className="p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 hover:border-orange-200 transition-colors group">
                      <div className="font-black text-neutral-900 group-hover:text-orange-600 transition-colors">{tech.name}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mt-1">{tech.role}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-12 pt-8 border-t border-neutral-50">
                  <h2 className="text-xl font-black italic uppercase tracking-tight text-orange-600 mb-8 flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-600 rounded-full" />
                    {t.specPlanTitle}
                  </h2>
                  <div className="space-y-6">
                    {t.specPlanSteps.map(item => (
                      <div key={item.step} className="flex gap-4 group">
                        <div className="bg-neutral-900 text-white w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs group-hover:bg-orange-600 transition-colors shadow-lg shadow-neutral-100">{item.step}</div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-neutral-900">{item.title}</h4>
                          <p className="text-xs text-neutral-500 font-medium mt-1">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
