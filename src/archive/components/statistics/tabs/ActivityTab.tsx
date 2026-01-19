/**
 * ActivityTab Component
 * 
 * Activity visualization with contribution heatmap and daily charts.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { ContributionHeatmap } from '../charts/ContributionHeatmap';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import type { useStatistics } from '../hooks/useStatistics';

interface ActivityTabProps {
  stats: ReturnType<typeof useStatistics>;
  accentColor: string;
}

export function ActivityTab({ stats, accentColor }: ActivityTabProps) {
  const {
    timeRange,
    setTimeRange,
    heatmapData,
    heatmapMetric,
    setHeatmapMetric,
    dailyChartData,
    wpmChartData,
  } = stats;

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium opacity-80">Reading Activity</h3>
        <TimeRangeSelector
          value={timeRange}
          onChange={setTimeRange}
          accentColor={accentColor}
        />
      </div>

      {/* Contribution Heatmap */}
      <div className="p-4 rounded-lg bg-reader-text/5">
        <ContributionHeatmap
          data={heatmapData}
          accentColor={accentColor}
          metric={heatmapMetric}
          onMetricChange={setHeatmapMetric}
        />
      </div>

      {/* Daily Activity Bar Chart */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80">Daily Reading (Last 14 Days)</h3>
        <div className="h-40 -ml-2" style={{ minHeight: '160px', minWidth: '200px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={160}>
            <BarChart data={dailyChartData}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                axisLine={false}
                tickLine={false}
                width={30}
                tickFormatter={(v) => `${v}m`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--reader-bg)',
                  border: '1px solid rgba(128, 128, 128, 0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${value} min`, 'Reading time']}
              />
              <Bar 
                dataKey="minutes" 
                fill={accentColor} 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* WPM Trend Line Chart */}
      {wpmChartData.length > 1 && (
        <div>
          <h3 className="text-sm font-medium mb-3 opacity-80">Reading Speed Trend</h3>
          <div className="h-32 -ml-2" style={{ minHeight: '128px', minWidth: '200px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={128}>
              <LineChart data={wpmChartData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  domain={['dataMin - 20', 'dataMax + 20']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--reader-bg)',
                    border: '1px solid rgba(128, 128, 128, 0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value} WPM`, 'Average speed']}
                />
                <Line 
                  type="monotone"
                  dataKey="wpm" 
                  stroke={accentColor} 
                  strokeWidth={2}
                  dot={{ fill: accentColor, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-lg bg-reader-text/5">
          <p className="text-xs opacity-60 uppercase">Active Days</p>
          <p className="text-lg font-semibold mt-1">
            {heatmapData.filter(d => d.level > 0).length}
          </p>
          <p className="text-xs opacity-50">in selected range</p>
        </div>
        <div className="p-3 rounded-lg bg-reader-text/5">
          <p className="text-xs opacity-60 uppercase">Total Time</p>
          <p className="text-lg font-semibold mt-1">
            {Math.round(heatmapData.reduce((sum, d) => sum + d.value, 0))}m
          </p>
          <p className="text-xs opacity-50">in selected range</p>
        </div>
        <div className="p-3 rounded-lg bg-reader-text/5">
          <p className="text-xs opacity-60 uppercase">Avg/Day</p>
          <p className="text-lg font-semibold mt-1">
            {(() => {
              const activeDays = heatmapData.filter(d => d.value > 0);
              const avg = activeDays.length > 0 
                ? Math.round(activeDays.reduce((sum, d) => sum + d.value, 0) / activeDays.length)
                : 0;
              return `${avg}m`;
            })()}
          </p>
          <p className="text-xs opacity-50">on active days</p>
        </div>
      </div>
    </div>
  );
}
