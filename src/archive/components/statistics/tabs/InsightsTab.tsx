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
  const { hourlyActivity, personalBests, contentBreakdown, kpis, progressBreakdown, rollingAverages, patternInsights, projections } = stats;

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

      {/* Rolling Averages Section */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Rolling Averages
          {rollingAverages.trend !== 'stable' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              rollingAverages.trend === 'improving' 
                ? 'bg-green-500/20 text-green-500' 
                : 'bg-red-500/20 text-red-500'
            }`}>
              {rollingAverages.trend === 'improving' ? 'Trending Up' : 'Trending Down'}
            </span>
          )}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* 7-Day Average */}
          <div className="p-4 rounded-lg bg-reader-text/5">
            <p className="text-xs font-medium opacity-60 mb-3">Last 7 Days (avg/day)</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Reading Time</span>
                <span className="font-semibold">{rollingAverages.sevenDay.readingTimeMinutes}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Words Read</span>
                <span className="font-semibold">{formatLargeNumber(rollingAverages.sevenDay.wordsRead)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Avg Speed</span>
                <span className="font-semibold">{rollingAverages.sevenDay.avgWpm} WPM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Sessions</span>
                <span className="font-semibold">{rollingAverages.sevenDay.sessionsPerDay}/day</span>
              </div>
            </div>
          </div>

          {/* 30-Day Average */}
          <div className="p-4 rounded-lg bg-reader-text/5">
            <p className="text-xs font-medium opacity-60 mb-3">Last 30 Days (avg/day)</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Reading Time</span>
                <span className="font-semibold">{rollingAverages.thirtyDay.readingTimeMinutes}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Words Read</span>
                <span className="font-semibold">{formatLargeNumber(rollingAverages.thirtyDay.wordsRead)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Avg Speed</span>
                <span className="font-semibold">{rollingAverages.thirtyDay.avgWpm} WPM</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm opacity-70">Sessions</span>
                <span className="font-semibold">{rollingAverages.thirtyDay.sessionsPerDay}/day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Bars */}
        {rollingAverages.thirtyDay.readingTimeMinutes > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-reader-text/5">
            <p className="text-xs opacity-60 mb-2">7-Day vs 30-Day Reading Time</p>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <div className="flex gap-1 items-center mb-1">
                  <div 
                    className="h-4 rounded transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, (rollingAverages.sevenDay.readingTimeMinutes / Math.max(rollingAverages.sevenDay.readingTimeMinutes, rollingAverages.thirtyDay.readingTimeMinutes)) * 100)}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                  <span className="text-xs opacity-70 whitespace-nowrap">7d</span>
                </div>
                <div className="flex gap-1 items-center">
                  <div 
                    className="h-4 rounded opacity-50 transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, (rollingAverages.thirtyDay.readingTimeMinutes / Math.max(rollingAverages.sevenDay.readingTimeMinutes, rollingAverages.thirtyDay.readingTimeMinutes)) * 100)}%`,
                      backgroundColor: accentColor,
                    }}
                  />
                  <span className="text-xs opacity-70 whitespace-nowrap">30d</span>
                </div>
              </div>
              <div className="text-right">
                {rollingAverages.sevenDay.readingTimeMinutes > rollingAverages.thirtyDay.readingTimeMinutes ? (
                  <span className="text-green-500 text-sm font-medium">
                    +{Math.round(((rollingAverages.sevenDay.readingTimeMinutes / rollingAverages.thirtyDay.readingTimeMinutes) - 1) * 100)}%
                  </span>
                ) : rollingAverages.sevenDay.readingTimeMinutes < rollingAverages.thirtyDay.readingTimeMinutes ? (
                  <span className="text-red-500 text-sm font-medium">
                    {Math.round(((rollingAverages.sevenDay.readingTimeMinutes / rollingAverages.thirtyDay.readingTimeMinutes) - 1) * 100)}%
                  </span>
                ) : (
                  <span className="text-reader-text/50 text-sm font-medium">0%</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reading Patterns */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Reading Patterns
        </h3>
        
        {/* Best/Worst Day + Weekend vs Weekday */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/20">
            <p className="text-xs opacity-60">Best Day to Read</p>
            <p className="text-lg font-semibold mt-1">{patternInsights.bestDay.dayName}</p>
            <p className="text-sm opacity-70">{patternInsights.bestDay.avgMinutes}m avg</p>
          </div>
          <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20">
            <p className="text-xs opacity-60">Least Active Day</p>
            <p className="text-lg font-semibold mt-1">{patternInsights.worstDay.dayName}</p>
            <p className="text-sm opacity-70">{patternInsights.worstDay.avgMinutes}m avg</p>
          </div>
        </div>

        {/* Weekday vs Weekend */}
        <div className="p-4 rounded-lg bg-reader-text/5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Weekday vs Weekend</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              patternInsights.weekdayVsWeekend.preference === 'weekend' 
                ? 'bg-purple-500/20 text-purple-400'
                : patternInsights.weekdayVsWeekend.preference === 'weekday'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
            }`}>
              {patternInsights.weekdayVsWeekend.preference === 'weekend' 
                ? 'Weekend Reader' 
                : patternInsights.weekdayVsWeekend.preference === 'weekday'
                  ? 'Weekday Reader'
                  : 'Balanced'}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-60 w-16">Weekday</span>
              <div className="flex-1 h-3 bg-reader-text/10 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (patternInsights.weekdayVsWeekend.weekdayAvgMinutes / Math.max(patternInsights.weekdayVsWeekend.weekdayAvgMinutes, patternInsights.weekdayVsWeekend.weekendAvgMinutes, 1)) * 100)}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">{patternInsights.weekdayVsWeekend.weekdayAvgMinutes}m</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-60 w-16">Weekend</span>
              <div className="flex-1 h-3 bg-reader-text/10 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, (patternInsights.weekdayVsWeekend.weekendAvgMinutes / Math.max(patternInsights.weekdayVsWeekend.weekdayAvgMinutes, patternInsights.weekdayVsWeekend.weekendAvgMinutes, 1)) * 100)}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
              <span className="text-sm font-medium w-12 text-right">{patternInsights.weekdayVsWeekend.weekendAvgMinutes}m</span>
            </div>
          </div>
          <p className="text-xs opacity-50 mt-2 text-center">
            {patternInsights.weekdayVsWeekend.weekendPercent}% of your reading happens on weekends
          </p>
        </div>

        {/* Day of Week Breakdown */}
        {patternInsights.dayOfWeekBreakdown.length > 0 && (
          <div className="p-4 rounded-lg bg-reader-text/5">
            <p className="text-xs opacity-60 mb-3">Reading by Day of Week</p>
            <div className="flex items-end justify-between gap-1 h-20">
              {patternInsights.dayOfWeekBreakdown.map((day) => {
                const maxMinutes = Math.max(...patternInsights.dayOfWeekBreakdown.map(d => d.avgMinutes), 1);
                const height = (day.avgMinutes / maxMinutes) * 100;
                return (
                  <div key={day.dayIndex} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full rounded-t transition-all duration-500"
                      style={{ 
                        height: `${Math.max(height, 4)}%`,
                        backgroundColor: day.dayIndex === patternInsights.bestDay.dayIndex ? accentColor : `${accentColor}60`,
                      }}
                    />
                    <span className="text-[10px] opacity-50">{day.dayName.slice(0, 3)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Consistency Status */}
        <div className="mt-4 p-4 rounded-lg bg-reader-text/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Reading Consistency</p>
            <p className="text-xs opacity-60">
              {patternInsights.consistency.activeDaysPercent}% active days in last 30 days
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            patternInsights.consistency.streakStatus === 'on-fire'
              ? 'bg-orange-500/20 text-orange-400'
              : patternInsights.consistency.streakStatus === 'consistent'
                ? 'bg-green-500/20 text-green-400'
                : patternInsights.consistency.streakStatus === 'sporadic'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-gray-500/20 text-gray-400'
          }`}>
            {patternInsights.consistency.streakStatus === 'on-fire' && 'On Fire!'}
            {patternInsights.consistency.streakStatus === 'consistent' && 'Consistent'}
            {patternInsights.consistency.streakStatus === 'sporadic' && 'Sporadic'}
            {patternInsights.consistency.streakStatus === 'inactive' && 'Getting Started'}
          </span>
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

      {/* Reading Projections */}
      <div>
        <h3 className="text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Reading Projections
          {projections.booksPerYear.confidence !== 'low' && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              projections.booksPerYear.confidence === 'high'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {projections.booksPerYear.confidence === 'high' ? 'High Confidence' : 'Medium Confidence'}
            </span>
          )}
        </h3>

        {/* Main Projections Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/20 text-center">
            <p className="text-2xl font-bold" style={{ color: accentColor }}>
              {projections.booksPerYear.estimate}
            </p>
            <p className="text-xs opacity-60 mt-1">books/year</p>
            <p className="text-[10px] opacity-40">
              Based on {projections.booksPerYear.basedOn === 'completion-rate' ? 'completions' : 'reading pace'}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-reader-text/5 text-center">
            <p className="text-2xl font-bold">{projections.hoursPerYear}</p>
            <p className="text-xs opacity-60 mt-1">hours/year</p>
          </div>
          <div className="p-4 rounded-lg bg-reader-text/5 text-center">
            <p className="text-2xl font-bold">{formatLargeNumber(projections.wordsPerYear)}</p>
            <p className="text-xs opacity-60 mt-1">words/year</p>
          </div>
        </div>

        {/* Backlog Estimate */}
        {projections.daysToFinishBacklog !== null && (
          <div className="p-4 rounded-lg bg-reader-text/5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Backlog Completion</p>
                <p className="text-xs opacity-60">
                  At your current pace, you'll finish your backlog in
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold" style={{ color: accentColor }}>
                  {projections.daysToFinishBacklog < 365 
                    ? `${projections.daysToFinishBacklog} days`
                    : `${(projections.daysToFinishBacklog / 365).toFixed(1)} years`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Milestones */}
        {(projections.milestones.nextBook || projections.milestones.oneHundredBooks || projections.milestones.oneMillionWords) && (
          <div className="p-4 rounded-lg bg-reader-text/5">
            <p className="text-xs font-medium opacity-60 mb-3">Upcoming Milestones</p>
            <div className="space-y-2">
              {projections.milestones.nextBook !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-70">Next book completion</span>
                  <span className="font-medium">~{projections.milestones.nextBook} days</span>
                </div>
              )}
              {projections.milestones.oneHundredBooks !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-70">100 books milestone</span>
                  <span className="font-medium">~{Math.round(projections.milestones.oneHundredBooks / 30)} months</span>
                </div>
              )}
              {projections.milestones.oneMillionWords !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-70">1 million words read</span>
                  <span className="font-medium">~{Math.round(projections.milestones.oneMillionWords / 30)} months</span>
                </div>
              )}
            </div>
          </div>
        )}

        {projections.booksPerYear.confidence === 'low' && (
          <p className="text-xs opacity-50 mt-2 text-center">
            Keep reading to improve projection accuracy
          </p>
        )}
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
