import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export type DemoPalette = {
  accent: string
  accentStrong: string
  accentSoft: string
  accentAlt: string
  bgStart: string
  bgEnd: string
  surface: string
  surfaceMuted: string
  border: string
  ink: string
  muted: string
}

export const demoSurfaceClass =
  'demo-surface border border-[var(--demo-border)] bg-[var(--demo-surface)]'

export const demoMutedSurfaceClass =
  'demo-surface-muted border border-[var(--demo-border)] bg-[var(--demo-surface-muted)]'

export const demoSmallSurfaceClass =
  'demo-surface-small border border-[var(--demo-border)] bg-[var(--demo-surface)]'

export function paletteStyle(palette: DemoPalette): CSSProperties {
  return {
    ['--demo-accent' as string]: palette.accent,
    ['--demo-accent-strong' as string]: palette.accentStrong,
    ['--demo-accent-soft' as string]: palette.accentSoft,
    ['--demo-accent-alt' as string]: palette.accentAlt,
    ['--demo-bg-start' as string]: palette.bgStart,
    ['--demo-bg-end' as string]: palette.bgEnd,
    ['--demo-surface' as string]: palette.surface,
    ['--demo-surface-muted' as string]: palette.surfaceMuted,
    ['--demo-border' as string]: palette.border,
    ['--demo-ink' as string]: palette.ink,
    ['--demo-muted' as string]: palette.muted,
  }
}

export function AppShell({
  children,
  className = '',
  palette,
}: {
  children: ReactNode
  className?: string
  palette: DemoPalette
}) {
  return (
    <div
      className={cn('min-h-screen text-[var(--demo-ink)]', className)}
      style={paletteStyle(palette)}
    >
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}) {
  const toneClass = {
    neutral: 'bg-slate-100 text-slate-700',
    info: 'bg-sky-100 text-sky-800',
    success: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-rose-100 text-rose-800',
  }[tone]

  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', toneClass)}>
      {children}
    </span>
  )
}

export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  return (
    <div className={cn('flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--demo-accent-soft)] text-sm font-semibold text-[var(--demo-accent-strong)]', className)}>
      {name
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')}
    </div>
  )
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--demo-muted)]', className)}>{children}</p>
}

export function NavChip({
  active = false,
  children,
  className = '',
  to,
}: {
  active?: boolean
  children: ReactNode
  className?: string
  to: string
}) {
  return (
    <Link
      className={cn(
        'inline-flex items-center rounded-full px-3 py-2 text-[13px] font-semibold transition-colors',
        active ? 'bg-[var(--demo-accent)] text-white shadow-[0_14px_24px_rgba(15,23,42,0.12)]' : 'bg-white/80 text-slate-600 hover:bg-white',
        className,
      )}
      to={to}
    >
      {children}
    </Link>
  )
}

export function TinyLink({
  children,
  className = '',
  to,
}: {
  children: ReactNode
  className?: string
  to: string
}) {
  return (
    <Link className={cn('inline-flex items-center gap-2 rounded-full bg-white/86 px-3 py-2 text-[13px] font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.04)]', className)} to={to}>
      {children}
    </Link>
  )
}

export function ReferencePill({
  href,
  label,
  className = '',
}: {
  href: string
  label: string
  className?: string
}) {
  return (
    <a
      className={cn(
        'inline-flex items-center rounded-full border border-black/8 bg-white/78 px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.04)] transition-colors hover:bg-white',
        className,
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  )
}
