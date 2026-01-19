/**
 * OverviewTab Component
 * 
 * Main dashboard view with KPI cards, goals, and quick stats.
 */

import { StatCard } from '../components/StatCard';
import { GoalProgress } from '../components/GoalProgress';
import type { useStatistics } from '../hooks/useStatistics';

interface OverviewTabProps {
  stats: ReturnType<typeof useStatistics>;
  accentColor: string;
  archiveItemsCount: number;
}

// Icons
const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FireIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
  </svg>
);

const BoltIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export function OverviewTab({ stats, accentColor, archiveItemsCount }: OverviewTabProps) {
  const { kpis, goalProgress } = stats;
  const hasGoals = goalProgress.daily || goalProgress.weekly || goalProgress.monthly;

  return (
    <div className="space-y-6">
      {/* Main KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Reading Time"
          value={kpis.totalReadingTime}
          icon={<ClockIcon />}
          accentColor={accentColor}
        />
        <StatCard
          label="Documents Completed"
          value={kpis.documentsCompleted}
          subtitle={`of ${archiveItemsCount} total`}
          icon={<CheckCircleIcon />}
          accentColor={accentColor}
        />
        <StatCard
          label="Current Streak"
          value={`${kpis.currentStreak} day${kpis.currentStreak !== 1 ? 's' : ''}`}
          subtitle={`Longest: ${kpis.longestStreak} days`}
          icon={<FireIcon />}
          accentColor={accentColor}
        />
        <StatCard
          label="Average WPM"
          value={kpis.averageWpm || '-'}
          subtitle={`${kpis.totalWordsRead} words read`}
          icon={<BoltIcon />}
          accentColor={accentColor}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-reader-text/5 text-center">
          <p className="text-xs opacity-60 uppercase tracking-wide">Daily Average</p>
          <p className="text-lg font-semibold mt-1">{kpis.dailyAverage} min</p>
        </div>
        <div className="p-3 rounded-lg bg-reader-text/5 text-center">
          <p className="text-xs opacity-60 uppercase tracking-wide">Finish Rate</p>
          <p className="text-lg font-semibold mt-1">{kpis.finishRate.rate}%</p>
          <p className="text-xs opacity-50">{kpis.finishRate.completed}/{kpis.finishRate.started}</p>
        </div>
        <div className="p-3 rounded-lg bg-reader-text/5 text-center">
          <p className="text-xs opacity-60 uppercase tracking-wide">Annotations</p>
          <p className="text-lg font-semibold mt-1">{kpis.totalAnnotations}</p>
        </div>
      </div>

      {/* Goals Section */}
      {hasGoals && (
        <div>
          <h3 className="text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
            <CalendarIcon />
            Goal Progress
          </h3>
          <div className="flex justify-around py-4 bg-reader-text/5 rounded-lg">
            {goalProgress.daily && (
              <GoalProgress
                label="Daily"
                current={goalProgress.daily.current}
                target={goalProgress.daily.target}
                percent={goalProgress.daily.percent}
                unit="min"
                accentColor={accentColor}
              />
            )}
            {goalProgress.weekly && (
              <GoalProgress
                label="Weekly"
                current={goalProgress.weekly.current}
                target={goalProgress.weekly.target}
                percent={goalProgress.weekly.percent}
                unit="min"
                accentColor={accentColor}
              />
            )}
            {goalProgress.monthly && (
              <GoalProgress
                label="Monthly"
                current={goalProgress.monthly.current}
                target={goalProgress.monthly.target}
                percent={goalProgress.monthly.percent}
                unit="docs"
                accentColor={accentColor}
              />
            )}
          </div>
        </div>
      )}

      {/* Content & Progress Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Content by Type */}
        <div>
          <h3 className="text-sm font-medium mb-3 opacity-80">Content by Type</h3>
          <div className="space-y-2">
            {stats.contentBreakdown.map(({ type, count, percent }) => (
              <div key={type} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="opacity-70">{getTypeLabel(type)}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-reader-text/10 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${percent}%`,
                        backgroundColor: accentColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {stats.contentBreakdown.length === 0 && (
              <p className="text-sm opacity-50">No items yet</p>
            )}
          </div>
        </div>

        {/* Progress Breakdown */}
        <div>
          <h3 className="text-sm font-medium mb-3 opacity-80">Reading Progress</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Completed
              </span>
              <span className="font-medium">{stats.progressBreakdown.completed}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                In Progress
              </span>
              <span className="font-medium">{stats.progressBreakdown.inProgress}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                Not Started
              </span>
              <span className="font-medium">{stats.progressBreakdown.notStarted}</span>
            </div>
          </div>
        </div>
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
