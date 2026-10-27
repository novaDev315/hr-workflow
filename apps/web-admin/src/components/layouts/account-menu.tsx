import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronsUpDown, KeyRound, LogOut, UserCog } from 'lucide-react'
import { useRef } from 'react'

import type { StoredAdminAccount } from '@/lib/auth-session'
import { formatStatus } from '@/lib/format'
import { cn } from '@/lib/utils'

function accountInitials(account: StoredAdminAccount) {
  return (
    account.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

const itemClass =
  'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-secondary'

// The signed-in account's panel: who you are, plus Account settings, Change
// password and Sign out.
// `sidebar` is the full row in the sidebar footer; `avatar` is the compact
// header button on tablet widths.
export function AccountMenu({
  account,
  variant,
  onChangePassword,
  onOpenSettings,
  onSignOut,
}: {
  account: StoredAdminAccount
  variant: 'sidebar' | 'avatar'
  onChangePassword: () => void
  onOpenSettings: () => void
  onSignOut: () => void
}) {
  // Opening the password sheet moves focus into it; don't pull focus back to
  // the trigger when the menu closes.
  const keepFocus = useRef(false)
  const initials = accountInitials(account)
  const roles = account.roles.length ? account.roles.map(formatStatus).join(', ') : formatStatus('ADMIN')

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        {variant === 'sidebar' ? (
          <button
            aria-label={`Account: ${account.fullName}`}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-card"
            type="button"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{account.fullName}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{roles}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <button
            aria-label={`Account: ${account.fullName}`}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex lg:hidden"
            title={account.fullName}
            type="button"
          >
            {initials}
          </button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={variant === 'sidebar' ? 'start' : 'end'}
          className={cn(
            'z-[60] rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-[0_18px_34px_rgba(78,50,23,0.12)]',
            variant === 'sidebar' ? 'w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px]' : 'w-[260px]',
          )}
          collisionPadding={12}
          onCloseAutoFocus={(event) => {
            if (keepFocus.current) event.preventDefault()
            keepFocus.current = false
          }}
          side={variant === 'sidebar' ? 'top' : 'bottom'}
          sideOffset={6}
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{account.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{account.email}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{roles}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border/80" />
          <DropdownMenu.Item className={cn(itemClass, 'text-foreground')} onSelect={onOpenSettings}>
            <UserCog className="h-4 w-4 shrink-0 opacity-70" />
            Account settings
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={cn(itemClass, 'text-foreground')}
            onSelect={() => {
              keepFocus.current = true
              onChangePassword()
            }}
          >
            <KeyRound className="h-4 w-4 shrink-0 opacity-70" />
            Change password
          </DropdownMenu.Item>
          <DropdownMenu.Item className={cn(itemClass, 'text-rose-800')} onSelect={onSignOut}>
            <LogOut className="h-4 w-4 shrink-0 opacity-70" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
