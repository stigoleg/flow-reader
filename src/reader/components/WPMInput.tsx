import { useState, useRef, useEffect, useCallback } from 'react';

interface WPMInputProps {
  value: number;
  onChange: (wpm: number) => void;
  onAdjust: (delta: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export default function WPMInput({
  value,
  onChange,
  onAdjust,
  min = 50,
  max = 1000,
  step = 10,
  className = '',
}: WPMInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value when external value changes (and not editing)
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toString());
    }
  }, [value, isEditing]);

  // Focus and select input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitValue = useCallback(() => {
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setInputValue(clamped.toString());
    } else {
      // Reset to current value if invalid
      setInputValue(value.toString());
    }
    setIsEditing(false);
  }, [inputValue, min, max, onChange, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      setInputValue(value.toString());
      setIsEditing(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newVal = Math.min(max, parseInt(inputValue, 10) + step);
      setInputValue(newVal.toString());
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newVal = Math.max(min, parseInt(inputValue, 10) - step);
      setInputValue(newVal.toString());
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label="Reading speed control">
      <button
        onClick={() => onAdjust(-step)}
        className="w-8 h-8 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
        title={`Decrease speed by ${step}`}
        aria-label={`Decrease speed by ${step} words per minute`}
      >
        −
      </button>
      
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={handleKeyDown}
          className="w-16 text-center text-sm font-mono bg-transparent border border-current/20 rounded px-1 py-0.5 focus:outline-none focus:border-current/40"
          aria-label="Words per minute"
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="text-sm font-mono w-16 text-center hover:bg-black/5 rounded px-1 py-0.5 transition-colors cursor-text"
          title="Click to edit WPM"
          aria-label={`Current speed: ${value} words per minute. Click to edit`}
        >
          {value}
        </button>
      )}
      
      <span className="text-xs opacity-60" aria-hidden="true">wpm</span>
      
      <button
        onClick={() => onAdjust(step)}
        className="w-8 h-8 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
        title={`Increase speed by ${step}`}
        aria-label={`Increase speed by ${step} words per minute`}
      >
        +
      </button>
    </div>
  );
}
