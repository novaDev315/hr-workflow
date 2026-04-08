import type { HTMLAttributes } from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const noticeVariants = cva(
  'flex items-start gap-3 rounded-[calc(var(--radius)-0.1rem)] border px-4 py-3 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
  {
    variants: {
      tone: {
        info: 'border-slate-200 bg-white text-slate-700',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
        warning: 'border-amber-200 bg-amber-50 text-amber-900',
        danger: 'border-rose-200 bg-rose-50 text-rose-900',
      },
    },
    defaultVariants: {
      tone: 'info',
    },
  }
)

type NoticeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof noticeVariants>

const toneIconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: AlertCircle,
} as const

export function Notice({ className, tone = 'info', children, ...props }: NoticeProps) {
  const resolvedTone = tone ?? 'info'
  const Icon = toneIconMap[resolvedTone]

  return (
    <div className={cn(noticeVariants({ tone: resolvedTone }), className)} {...props}>
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0 flex-1 leading-6">{children}</div>
    </div>
  )
}
