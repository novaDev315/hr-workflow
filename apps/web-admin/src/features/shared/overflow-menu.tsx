import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type OverflowMenuItem = {
  label: string
  onSelect: () => void
  icon?: LucideIcon
  tone?: 'default' | 'danger'
  disabled?: boolean
  hidden?: boolean
}

// Compact, keyboard-accessible "more actions" menu (Radix handles arrow keys,
// Escape, typeahead and focus return).
export function OverflowMenu({
  label,
  items,
  align = 'end',
  className,
}: {
  label: string
  items: OverflowMenuItem[]
  align?: 'start' | 'end'
  className?: string
}) {
  const visible = items.filter((item) => !item.hidden)
  if (visible.length === 0) return null

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={label}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-secondary data-[state=open]:text-foreground',
            className,
          )}
          title={label}
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          className="z-[60] min-w-[200px] rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-[0_18px_34px_rgba(78,50,23,0.12)]"
          sideOffset={6}
        >
          {visible.map((item) => (
            <DropdownMenu.Item
              className={cn(
                'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-secondary',
                item.tone === 'danger' ? 'text-rose-800' : 'text-foreground',
              )}
              disabled={item.disabled}
              key={item.label}
              onSelect={item.onSelect}
            >
              {item.icon ? <item.icon className="h-4 w-4 shrink-0 opacity-70" /> : null}
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
