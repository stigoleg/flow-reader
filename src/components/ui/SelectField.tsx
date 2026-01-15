interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[] | SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  className = '',
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm mb-1 opacity-70">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-3 rounded-lg border border-current/20 bg-transparent text-base md:py-2 md:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
