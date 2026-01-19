/**
 * GoalProgress Component
 * 
 * Circular progress ring for displaying goal completion.
 */

interface GoalProgressProps {
  label: string;
  current: number;
  target: number;
  percent: number;
  unit: string;
  accentColor: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GoalProgress({ 
  label, 
  current, 
  target, 
  percent, 
  unit,
  accentColor,
  size = 'md',
}: GoalProgressProps) {
  const sizeClasses = {
    sm: { container: 'w-16 h-16', stroke: 4, text: 'text-sm' },
    md: { container: 'w-24 h-24', stroke: 6, text: 'text-base' },
    lg: { container: 'w-32 h-32', stroke: 8, text: 'text-lg' },
  };
  
  const { container, stroke, text } = sizeClasses[size];
  const radius = 50 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  
  const isComplete = percent >= 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${container} relative`}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="opacity-10"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isComplete ? (
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className={`${text} font-semibold`}>{percent}%</span>
          )}
        </div>
      </div>
      
      <div className="text-center">
        <p className="text-xs opacity-60 uppercase tracking-wide">{label}</p>
        <p className="text-sm">
          <span className="font-medium">{current}</span>
          <span className="opacity-50"> / {target} {unit}</span>
        </p>
      </div>
    </div>
  );
}
