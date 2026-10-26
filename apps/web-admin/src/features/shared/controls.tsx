import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ALL = '__all__'
const NONE = '__none__'

export type Option = { value: string; label: string }

// Radix Select cannot hold an empty value; this maps '' to an "All ..." item.
export function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: Option[]
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Select value={value || ALL} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
        <SelectTrigger aria-label={label} className="h-10" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// Labelled select for forms. `noneLabel` adds an explicit empty choice.
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  hint,
  error,
  disabled,
  required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  noneLabel?: string
  hint?: ReactNode
  error?: string | null
  disabled?: boolean
  required?: boolean
}) {
  const selectValue = value ? value : noneLabel ? NONE : undefined
  return (
    <Field className="content-start">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        disabled={disabled}
        onValueChange={(next) => onChange(next === NONE ? '' : next)}
        required={required}
        value={selectValue}
      >
        <SelectTrigger aria-invalid={error ? true : undefined} className="h-11" id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {noneLabel ? <SelectItem value={NONE}>{noneLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

export function TextField({
  id,
  label,
  hint,
  error,
  children,
  optional,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  optional?: boolean
}) {
  return (
    <Field className="content-start">
      <FieldLabel htmlFor={id}>
        {label}
        {optional ? (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </FieldLabel>
      {children}
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: LucideIcon }[]
}) {
  return (
    <div
      aria-label={label}
      className="inline-flex h-10 shrink-0 items-center rounded-xl border border-border bg-secondary/50 p-1"
      role="radiogroup"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            aria-checked={active}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.icon ? <option.icon className="h-3.5 w-3.5" /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
