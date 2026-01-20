/**
 * CompareTab Component
 * 
 * Period comparison view with delta indicators.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from '../components/ChartContainer';
import { ComparisonCard } from '../components/ComparisonCard';
import { formatReadingTime } from '@/lib/stats-service';
import type { useStatistics } from '../hooks/useStatistics';

interface CompareTabProps {
  stats: ReturnType<typeof useStatistics>;
  accentColor: string;
}

const COMPARISON_TYPES = [
  { value: 'week' as const, label: 'Week', description: 'This week vs last week' },
  { value: 'month' as const, label: 'Month', description: 'This month vs last month' },
  { value: 'year' as const, label: 'Year', description: 'This year vs last year' },
];

export function CompareTab({ stats, accentColor }: CompareTabProps) {
  const { comparisonType, setComparisonType, comparison } = stats;

  if (!comparison) {
    return (
      <div className="flex items-center justify-center py-12 opacity-50">
        Loading comparison data...
      </div>
    );
  }

  const { period1, period2, deltas } = comparison;

  // Prepare chart data for comparison
  const chartData = [
    {
      metric: 'Time',
      current: Math.round(period1.readingTimeMs / 60000),
      previous: Math.round(period2.readingTimeMs / 60000),
    },
    {
      metric: 'Words',
      current: Math.round(period1.wordsRead / 100), // Scale down for chart
      previous: Math.round(period2.wordsRead / 100),
    },
    {
      metric: 'Docs',
      current: period1.documentsCompleted,
      previous: period2.documentsCompleted,
    },
    {
      metric: 'Days',
      current: period1.activeDays,
      previous: period2.activeDays,
    },
  ];

  const currentLabel = COMPARISON_TYPES.find(t => t.value === comparisonType)?.label || '';

  return (
    <div className="space-y-6">
      {/* Period Type Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium opacity-80">Compare Periods</h3>
        <div className="flex gap-1">
          {COMPARISON_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setComparisonType(type.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                comparisonType === type.value
                  ? 'text-white'
                  : 'bg-reader-text/5 opacity-60 hover:opacity-100'
              }`}
              style={comparisonType === type.value ? { backgroundColor: accentColor } : undefined}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm opacity-60">
        {COMPARISON_TYPES.find(t => t.value === comparisonType)?.description}
      </p>

      {/* Comparison Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        <ComparisonCard
          label="Reading Time"
          currentValue={formatReadingTime(period1.readingTimeMs)}
          previousValue={formatReadingTime(period2.readingTimeMs)}
          deltaPercent={deltas.readingTimePercent}
        />
        <ComparisonCard
          label="Words Read"
          currentValue={period1.wordsRead.toLocaleString()}
          previousValue={period2.wordsRead.toLocaleString()}
          deltaPercent={deltas.wordsReadPercent}
        />
        <ComparisonCard
          label="Documents Completed"
          currentValue={period1.documentsCompleted}
          previousValue={period2.documentsCompleted}
          deltaPercent={deltas.documentsCompletedPercent}
        />
        <ComparisonCard
          label="Active Days"
          currentValue={period1.activeDays}
          previousValue={period2.activeDays}
          deltaPercent={deltas.activeDaysPercent}
        />
      </div>

      {/* WPM Comparison */}
      <div className="p-4 rounded-lg bg-reader-text/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-60 uppercase tracking-wide">Average Reading Speed</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-2xl font-semibold">{period1.avgWpm || '-'} WPM</span>
              <span className="text-sm opacity-50">vs {period2.avgWpm || '-'} WPM</span>
            </div>
          </div>
          {period1.avgWpm > 0 && period2.avgWpm > 0 && (
            <div 
              className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
                deltas.avgWpmPercent === 0 ? 'bg-gray-500/20 text-gray-500' :
                deltas.avgWpmPercent > 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
              }`}
            >
              {deltas.avgWpmPercent !== 0 && (
                <svg 
                  className={`w-3 h-3 ${deltas.avgWpmPercent > 0 ? '' : 'rotate-180'}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              <span>{deltas.avgWpmPercent > 0 ? '+' : ''}{deltas.avgWpmPercent}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Comparison Bar Chart */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80">Side-by-Side Comparison</h3>
        <div className="h-48">
          <ChartContainer minWidth={200} minHeight={192}>
            <BarChart data={chartData} barGap={4}>
              <XAxis 
                dataKey="metric" 
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--reader-bg)',
                  border: '1px solid rgba(128, 128, 128, 0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar 
                dataKey="current" 
                name={`This ${currentLabel}`}
                fill={accentColor} 
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
              <Bar 
                dataKey="previous" 
                name={`Last ${currentLabel}`}
                fill={`${accentColor}50`}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ChartContainer>
        </div>
        <p className="text-xs opacity-50 text-center mt-2">
          Note: Words shown in hundreds for better chart readability
        </p>
      </div>
    </div>
  );
}
