/**
 * StatCard Component
 * 
 * Reusable KPI card for displaying statistics with an icon.
 */

import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  accentColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({ label, value, subtitle, icon, accentColor, trend }: StatCardProps) {
  return (
    <div className="p-4 rounded-lg bg-reader-text/5 flex items-start gap-3">
      <div 
        className="p-2 rounded-lg flex-shrink-0"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <div style={{ color: accentColor }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs opacity-60 uppercase tracking-wide">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-xl font-semibold">{value}</p>
          {trend && (
            <span 
              className={`text-xs font-medium ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs opacity-50 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
