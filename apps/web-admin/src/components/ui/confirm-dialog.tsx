import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  /** Extra content between description and actions (summary, warnings). */
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'destructive'
  busy?: boolean
  confirmDisabled?: boolean
  onConfirm: () => void | Promise<void>
  className?: string
}

/** Calm confirmation dialog for consequential actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  className,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-[rgba(39,30,20,0.42)] backdrop-blur-[3px]" />
        <AlertDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.2rem] border border-border/80 bg-card text-card-foreground shadow-[0_34px_110px_rgba(39,30,20,0.28)] outline-none',
            className,
          )}
        >
          <div className="overflow-y-auto px-5 pb-4 pt-5">
            <AlertDialog.Title className="app-editorial text-[1.35rem] leading-tight text-foreground">
              {title}
            </AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
            )}
            {children ? <div className="mt-4 space-y-3">{children}</div> : null}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-[rgba(250,249,245,0.96)] px-5 py-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" disabled={busy}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant={tone === 'destructive' ? 'destructive' : 'default'}
              disabled={busy || confirmDisabled}
              onClick={() => void onConfirm()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
