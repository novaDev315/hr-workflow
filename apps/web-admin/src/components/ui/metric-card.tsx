import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type MetricCardProps = {
  label: string
  value: string
  detail?: string
  icon?: LucideIcon
  tone?: string
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'bg-accent text-accent-foreground',
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
            {value}
          </p>
          {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        {Icon ? (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
