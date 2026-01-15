interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  formatValue,
  onChange,
  className = '',
}: SliderFieldProps) {
  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`;

  return (
    <div className={className}>
      <label className="block text-sm mb-1 opacity-70">
        {label}: {displayValue}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
