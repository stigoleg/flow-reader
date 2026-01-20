/**
 * ChartContainer Component
 * 
 * A wrapper for recharts ResponsiveContainer that waits for valid dimensions
 * before rendering the chart. This prevents the "width(-1) and height(-1)"
 * warnings that occur when charts are rendered in hidden containers or
 * during modal/tab transitions.
 */

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  /** Chart content to render inside ResponsiveContainer */
  children: ReactNode;
  /** Minimum width for the container */
  minWidth?: number;
  /** Minimum height for the container */
  minHeight?: number;
  /** Additional className for the container */
  className?: string;
  /** Debounce time in ms before rendering (allows for animations) */
  debounceMs?: number;
}

/**
 * A wrapper component that ensures charts only render when their container
 * has valid dimensions. This prevents recharts warnings about negative dimensions.
 */
export function ChartContainer({
  children,
  minWidth = 200,
  minHeight = 100,
  className = '',
  debounceMs = 50,
}: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkDimensions = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Only render when we have valid positive dimensions
      if (width > 0 && height > 0) {
        // Use a small debounce to allow for layout to stabilize
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setIsReady(true);
        }, debounceMs);
      }
    };

    // Initial check
    checkDimensions();

    // Use ResizeObserver for more reliable dimension detection
    const observer = new ResizeObserver(() => {
      checkDimensions();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [debounceMs]);

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ minWidth, minHeight }}
    >
      {isReady ? (
        <ResponsiveContainer 
          width="100%" 
          height="100%" 
          minWidth={minWidth} 
          minHeight={minHeight}
        >
          {children}
        </ResponsiveContainer>
      ) : (
        // Placeholder while waiting for dimensions
        <div 
          className="w-full h-full flex items-center justify-center opacity-30"
          style={{ minWidth, minHeight }}
        >
          <svg 
            className="w-6 h-6 animate-pulse" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
            />
          </svg>
        </div>
      )}
    </div>
  );
}
