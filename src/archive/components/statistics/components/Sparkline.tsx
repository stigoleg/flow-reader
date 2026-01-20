/**
 * Sparkline Component
 * 
 * Minimal inline chart for showing trends in stat cards.
 */

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

export function Sparkline({ data, color, width = 60, height = 24, fill = true }: SparklineProps) {
  if (data.length < 2) return null;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  // Normalize data points to fit within the height
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });
  
  // Create SVG path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // Create filled area path (for gradient fill)
  const areaPath = fill 
    ? `${linePath} L ${width} ${height} L 0 ${height} Z` 
    : '';
  
  return (
    <svg 
      width={width} 
      height={height} 
      className="flex-shrink-0"
      viewBox={`0 0 ${width} ${height}`}
    >
      {fill && (
        <defs>
          <linearGradient id={`sparkline-gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
      )}
      
      {/* Filled area */}
      {fill && areaPath && (
        <path
          d={areaPath}
          fill={`url(#sparkline-gradient-${color.replace('#', '')})`}
        />
      )}
      
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* End dot */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}
