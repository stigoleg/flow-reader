interface ButtonGroupOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface ButtonGroupProps<T extends string> {
  options: readonly ButtonGroupOption<T>[] | ButtonGroupOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: ButtonGroupProps<T>) {
  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors min-h-[44px] md:py-1.5 md:min-h-0 ${
            value === option.value
              ? 'border-current bg-current/10'
              : 'border-current/20 hover:border-current/40'
          }`}
          title={option.description}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
