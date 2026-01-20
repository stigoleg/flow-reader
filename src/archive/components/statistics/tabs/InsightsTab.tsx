/**
 * InsightsTab Component
 * 
 * Fun visualizations, patterns, and personal bests.
 */

import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { ChartContainer } from '../components/ChartContainer';
import { formatReadingTime, formatLargeNumber } from '@/lib/stats-service';
import type { useStatistics } from '../hooks/useStatistics';

interface InsightsTabProps {
  stats: ReturnType<typeof useStatistics>;
  accentColor: string;
}

export function InsightsTab({ stats, accentColor }: InsightsTabProps) {
  const { hourlyActivity, personalBests, contentBreakdown, kpis, progressBreakdown } = stats;

  // Find best hour to read
  const bestHour = [...hourlyActivity].sort((a, b) => b.totalReadingTimeMs - a.totalReadingTimeMs)[0];
  const bestHourLabel = bestHour?.hour !== undefined 
    ? `${bestHour.hour.toString().padStart(2, '0')}:00 - ${((bestHour.hour + 1) % 24).toString().padStart(2, '0')}:00`
    : 'N/A';

  // Prepare hourly chart data
  const hourlyChartData = hourlyActivity.map(h => ({
    hour: `${h.hour.toString().padStart(2, '0')}:00`,
    minutes: Math.round(h.totalReadingTimeMs / 60000),
  }));

  // Prepare radar chart data for reading habits
  const radarData = [
    { 
      subject: 'Consistency', 
      value: Math.min(100, kpis.currentStreak * 10), // 10 days = 100%
      fullMark: 100 
    },
    { 
      subject: 'Speed', 
      value: Math.min(100, Math.round((kpis.averageWpm / 400) * 100)), // 400 WPM = 100%
      fullMark: 100 
    },
    { 
      subject: 'Volume', 
      value: Math.min(100, Math.round((kpis.dailyAverage / 60) * 100)), // 60 min/day = 100%
      fullMark: 100 
    },
    { 
      subject: 'Variety', 
      value: Math.min(100, contentBreakdown.length * 25), // 4 types = 100%
      fullMark: 100 
    },
    { 
      subject: 'Completion', 
      value: kpis.finishRate.rate, // Already 0-100
      fullMark: 100 
    },
    { 
      subject: 'Engagement', 
      value: Math.min(100, Math.round((kpis.totalAnnotations / 50) * 100)), // 50 annotations = 100%
      fullMark: 100 
    },
  ];

  // Prepare pie chart data for content types
  const COLORS = [accentColor, '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4'];
  const pieData = contentBreakdown.slice(0, 6).map((item, index) => ({
    name: item.type,
    value: item.count,
    color: COLORS[index % COLORS.length],
  }));

  // Calculate cumulative words data (mock - would need to aggregate over time)
  const totalItems = progressBreakdown.completed + progressBreakdown.inProgress + progressBreakdown.notStarted;

  return (
    <div className="space-y-6">
      {/* Personal Bests Section */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Personal Bests
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/20">
            <p className="text-xs opacity-60">Longest Session</p>
            <p className="text-lg font-semibold mt-1">
              {personalBests?.longestSession 
                ? formatReadingTime(personalBests.longestSession.durationMs)
                : '-'}
            </p>
            {personalBests?.longestSession && (
              <p className="text-xs opacity-50 mt-0.5">
                {new Date(personalBests.longestSession.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20">
            <p className="text-xs opacity-60">Most Words/Day</p>
            <p className="text-lg font-semibold mt-1">
              {personalBests?.mostWordsInDay 
                ? formatLargeNumber(personalBests.mostWordsInDay.words)
                : '-'}
            </p>
            {personalBests?.mostWordsInDay && (
              <p className="text-xs opacity-50 mt-0.5">
                {new Date(personalBests.mostWordsInDay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20">
            <p className="text-xs opacity-60">Fastest Speed</p>
            <p className="text-lg font-semibold mt-1">
              {personalBests?.fastestWpm 
                ? `${personalBests.fastestWpm.wpm} WPM`
                : '-'}
            </p>
            {personalBests?.fastestWpm && (
              <p className="text-xs opacity-50 mt-0.5">
                {new Date(personalBests.fastestWpm.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Best Time to Read */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80">Best Time to Read</h3>
        <div className="p-4 rounded-lg bg-reader-text/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm">Your peak reading hour:</p>
            <p className="font-semibold" style={{ color: accentColor }}>{bestHourLabel}</p>
          </div>
          <div className="h-24">
            <ChartContainer minWidth={200} minHeight={96}>
              <BarChart data={hourlyChartData}>
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 8, fill: 'currentColor', opacity: 0.5 }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--reader-bg)',
                    border: '1px solid rgba(128, 128, 128, 0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value} min total`, 'Reading time']}
                />
                <Bar 
                  dataKey="minutes" 
                  fill={accentColor}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </div>

      {/* Reading Habits Radar */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80">Reading Habits Profile</h3>
        <div className="h-64">
          <ChartContainer minWidth={200} minHeight={256}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="currentColor" strokeOpacity={0.1} />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 100]} 
                tick={{ fontSize: 9, fill: 'currentColor', opacity: 0.4 }}
              />
              <Radar
                name="Your habits"
                dataKey="value"
                stroke={accentColor}
                fill={accentColor}
                fillOpacity={0.3}
              />
            </RadarChart>
          </ChartContainer>
        </div>
      </div>

      {/* Content Type Pie Chart */}
      {pieData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 opacity-80">Content Mix</h3>
          <div className="flex items-center gap-4">
            <div className="h-40 w-40">
              <ChartContainer minWidth={160} minHeight={160}>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'var(--reader-bg)',
                      border: '1px solid rgba(128, 128, 128, 0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ChartContainer>
            </div>
            <div className="flex-1 space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="opacity-70">{getTypeLabel(item.name)}</span>
                  </span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Backlog Velocity */}
      <div className="p-4 rounded-lg bg-reader-text/5">
        <h3 className="text-sm font-medium mb-2 opacity-80">Reading Backlog</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold">{progressBreakdown.notStarted + progressBreakdown.inProgress}</p>
            <p className="text-xs opacity-50">items waiting to be read</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-green-500">{progressBreakdown.completed}</p>
            <p className="text-xs opacity-50">completed</p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full bg-reader-text/10 overflow-hidden flex">
          <div 
            className="h-full bg-green-500"
            style={{ width: `${(progressBreakdown.completed / Math.max(totalItems, 1)) * 100}%` }}
          />
          <div 
            className="h-full bg-yellow-500"
            style={{ width: `${(progressBreakdown.inProgress / Math.max(totalItems, 1)) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs opacity-50">
          <span>Completed: {Math.round((progressBreakdown.completed / Math.max(totalItems, 1)) * 100)}%</span>
          <span>In Progress: {Math.round((progressBreakdown.inProgress / Math.max(totalItems, 1)) * 100)}%</span>
        </div>
      </div>

      {/* Fun Fact */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/20">
        <p className="text-sm font-medium mb-1">Fun Reading Stat</p>
        <p className="text-sm opacity-70">
          {kpis.totalWordsRead !== '0' 
            ? `You've read enough words to fill ${Math.round(Number(kpis.totalWordsRead.replace(/[KM]/g, '')) * (kpis.totalWordsRead.includes('M') ? 4000 : kpis.totalWordsRead.includes('K') ? 4 : 0.004))} book pages!`
            : 'Start reading to unlock fun statistics!'}
        </p>
      </div>
    </div>
  );
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    web: 'Web articles',
    pdf: 'PDFs',
    epub: 'EPUBs',
    mobi: 'MOBI books',
    docx: 'Word docs',
    paste: 'Pasted text',
  };
  return labels[type] || type;
}
