export type OmEnergyReportType =
  | 'daily_energy'
  | 'monthly_energy'
  | 'energy_cost_analysis'
  | 'pump_efficiency'
  | 'kwh_per_kl';

export const OM_ENERGY_METRICS = [
  { key: 'energyKwh', label: 'Electricity Consumption', unit: 'kWh' },
  { key: 'pumpRunningHours', label: 'Pump Running Hours', unit: 'hrs' },
  { key: 'energyCost', label: 'Energy Cost', unit: 'INR' },
  { key: 'powerFactor', label: 'Power Factor', unit: '' },
  { key: 'pumpEfficiencyPct', label: 'Pump Efficiency', unit: '%' },
  { key: 'waterPumpedKl', label: 'Water Pumped', unit: 'KL' },
  { key: 'kwhPerKl', label: 'kWh per KL Water Pumped', unit: 'kWh/KL' },
] as const;

export const OM_ENERGY_REPORT_TYPES: Array<{ type: OmEnergyReportType; label: string; description: string }> = [
  { type: 'daily_energy', label: 'Daily Energy Report', description: 'Day-wise consumption, hours, and cost totals' },
  { type: 'monthly_energy', label: 'Monthly Energy Report', description: 'Month-wise energy and pumping summary' },
  { type: 'energy_cost_analysis', label: 'Energy Cost Analysis', description: 'Cost breakdown and trends' },
  { type: 'pump_efficiency', label: 'Pump Efficiency Report', description: 'Efficiency by pump asset' },
  { type: 'kwh_per_kl', label: 'kWh per KL Report', description: 'Specific energy consumption per kilolitre pumped' },
];

export function computeKwhPerKl(energyKwh?: number | null, waterPumpedKl?: number | null): number | null {
  if (energyKwh == null || waterPumpedKl == null || waterPumpedKl <= 0) return null;
  return Math.round((energyKwh / waterPumpedKl) * 1000) / 1000;
}
