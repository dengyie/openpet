interface SegmentedOption<T extends string | number = string | number> {
  label: string
  value: T
}

interface SegmentedControlProps<T extends string | number = string | number> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string | number>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
