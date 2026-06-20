import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type FormDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  kicker?: string
  description?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  kicker,
  description,
  children,
  className,
  bodyClassName,
}: FormDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(39,30,20,0.36)] backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-2 bottom-2 top-2 z-50 flex flex-col overflow-hidden rounded-[1.2rem] border border-border/80 bg-card text-card-foreground shadow-[0_30px_90px_rgba(39,30,20,0.24)] outline-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-4 sm:w-[min(720px,calc(100vw-2rem))]',
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 bg-[rgba(250,249,245,0.96)] px-4 py-4 sm:px-5">
            <div className="min-w-0">
              {kicker ? <p className="app-kicker">{kicker}</p> : null}
              <Dialog.Title className="app-editorial mt-1 text-[1.35rem] leading-tight text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close form"
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div
            className={cn(
              'flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5',
              bodyClassName,
            )}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
