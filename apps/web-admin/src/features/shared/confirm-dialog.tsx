import { useCallback, useRef, useState, type ReactNode } from 'react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type ConfirmOptions = {
  title: string
  description?: ReactNode
  confirmLabel: string
  tone?: 'default' | 'danger'
}

// Promise-based replacement for window.confirm that matches the app chrome.
// Usage: const [confirm, confirmDialog] = useConfirm(); render {confirmDialog};
// if (!(await confirm({...}))) return
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setOptions(null)
  }

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
      title={options?.title ?? ''}
      description={options?.description}
      confirmLabel={options?.confirmLabel ?? ''}
      tone={options?.tone === 'danger' ? 'destructive' : 'default'}
      onConfirm={() => settle(true)}
    />
  )

  return [confirm, dialog]
}
