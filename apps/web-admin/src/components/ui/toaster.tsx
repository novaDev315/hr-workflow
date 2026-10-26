import * as ToastPrimitive from '@radix-ui/react-toast'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'

import { currentToasts, dismissToast, subscribeToasts, type ToastTone } from '@/lib/toast'
import { cn } from '@/lib/utils'

const toneClass: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-[rgb(236,246,237)] text-emerald-950',
  danger: 'border-rose-200 bg-[rgb(250,236,233)] text-rose-950',
}

export function Toaster() {
  const current = useSyncExternalStore(subscribeToasts, currentToasts)

  return (
    <ToastPrimitive.Provider label="Notification" swipeDirection="right">
      {current.map((item) => {
        const Icon = item.tone === 'success' ? CheckCircle2 : AlertCircle
        return (
          <ToastPrimitive.Root
            className={cn(
              'pointer-events-auto flex w-full items-start gap-3 rounded-[calc(var(--radius)-0.1rem)] border px-3.5 py-3 text-sm shadow-[0_18px_48px_rgba(39,30,20,0.18)] data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2 data-[swipe=end]:animate-out',
              toneClass[item.tone],
            )}
            // Errors stay until dismissed: the user usually has to act on them.
            duration={item.tone === 'danger' ? Infinity : 5000}
            key={item.id}
            onOpenChange={(open) => {
              if (!open) dismissToast(item.id)
            }}
            type={item.tone === 'danger' ? 'foreground' : 'background'}
          >
            <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
            <ToastPrimitive.Description className="min-w-0 flex-1 leading-6">
              {item.message}
            </ToastPrimitive.Description>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] m-0 flex list-none flex-col gap-2 p-4 outline-none sm:inset-x-auto sm:right-0 sm:w-[400px] sm:p-6" />
    </ToastPrimitive.Provider>
  )
}
