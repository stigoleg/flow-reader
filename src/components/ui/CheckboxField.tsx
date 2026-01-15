interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  className = '',
}: CheckboxFieldProps) {
  return (
    <div className={`flex items-center gap-3 min-h-[44px] md:min-h-0 ${className}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <label htmlFor={id} className="text-sm flex-1">
        {label}
      </label>
    </div>
  );
}
