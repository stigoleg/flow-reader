/**
 * ComparisonCard Component
 * 
 * Displays a metric comparison between two periods with delta indicator.
 */

interface ComparisonCardProps {
  label: string;
  currentValue: string | number;
  previousValue: string | number;
  deltaPercent: number;
}

export function ComparisonCard({ 
  label, 
  currentValue, 
  previousValue, 
  deltaPercent,
}: ComparisonCardProps) {
  const isPositive = deltaPercent > 0;
  const isNeutral = deltaPercent === 0;
  
  return (
    <div className="p-4 rounded-lg bg-reader-text/5">
      <p className="text-xs opacity-60 uppercase tracking-wide mb-2">{label}</p>
      
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold">{currentValue}</p>
          <p className="text-xs opacity-50 mt-1">
            vs {previousValue} previously
          </p>
        </div>
        
        <div 
          className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
            isNeutral ? 'bg-gray-500/20 text-gray-500' :
            isPositive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          }`}
        >
          {!isNeutral && (
            <svg 
              className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          <span>{isNeutral ? '0%' : `${isPositive ? '+' : ''}${deltaPercent}%`}</span>
        </div>
      </div>
    </div>
  );
}
