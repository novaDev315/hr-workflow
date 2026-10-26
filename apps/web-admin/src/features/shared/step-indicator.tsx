import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

export type StepState = 'done' | 'current' | 'upcoming' | 'skipped'

export function StepIndicator({
  steps,
}: {
  steps: { label: string; state: StepState }[]
}) {
  const currentIndex = steps.findIndex((step) => step.state === 'current')

  return (
    <ol
      aria-label={`Step ${currentIndex + 1} of ${steps.length}`}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => (
        <li
          aria-current={step.state === 'current' ? 'step' : undefined}
          className="min-w-0"
          key={step.label}
        >
          <div
            className={cn(
              'h-1 rounded-full',
              step.state === 'done' && 'bg-primary',
              step.state === 'current' && 'bg-primary/60',
              step.state === 'skipped' && 'bg-border',
              step.state === 'upcoming' && 'bg-border/70',
            )}
          />
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                step.state === 'done' && 'bg-primary text-primary-foreground',
                step.state === 'current' && 'border border-primary text-primary',
                (step.state === 'upcoming' || step.state === 'skipped') &&
                  'border border-border text-muted-foreground',
              )}
            >
              {step.state === 'done' ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span
              className={cn(
                'truncate text-xs',
                step.state === 'current'
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {step.label}
              {step.state === 'skipped' ? (
                <span className="sr-only"> (skipped)</span>
              ) : null}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
