import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Right-anchored drawer with a fixed header, scrolling body and a pinned
// footer for the primary actions. Full width on phones.
export function SideSheet({
  open,
  onOpenChange,
  title,
  description,
  header,
  footer,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  // Sheets open from state rather than a Radix trigger, so Radix has nothing
  // to return focus to on close. Remember what had focus and go back to it.
  const returnFocus = useRef<HTMLElement | null>(null)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(39,30,20,0.38)] backdrop-blur-[2px]" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            const target = returnFocus.current
            returnFocus.current = null
            if (target?.isConnected) {
              event.preventDefault()
              target.focus()
            }
          }}
          onOpenAutoFocus={() => {
            // Runs before focus moves into the sheet.
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-border/80 bg-card text-card-foreground shadow-[-24px_0_80px_rgba(39,30,20,0.18)] outline-none sm:inset-y-2 sm:right-2 sm:rounded-[1.2rem] sm:border',
            className,
          )}
        >
          <div className="shrink-0 border-b border-border/70 px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="app-editorial text-[1.45rem] leading-tight text-foreground">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {description}
                  </Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{title}</Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <Button aria-label="Close" className="-mr-2 shrink-0" size="icon" type="button" variant="ghost">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
            {header ? <div className="mt-4">{header}</div> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
          {footer ? (
            <div className="shrink-0 border-t border-border/70 bg-[rgba(250,249,245,0.96)] px-4 py-3 sm:rounded-b-[1.2rem] sm:px-6">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
