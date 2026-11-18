import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/class-names'
import { NativeChatExpandable } from '../messages/disclosure/NativeChatExpandable'

export function ToolChips({
  open,
  onOpenChange,
  live,
  summary,
  action,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  live: boolean
  summary: ReactNode
  action: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0 py-1">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-live="polite"
          data-native-chat-tool-run-state={live ? 'live' : 'settled'}
          onClick={() => onOpenChange(!open)}
          className="group/tool-run flex min-h-7 min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-chat-foreground-faint transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
          {summary}
        </button>
        {action}
      </div>
      <NativeChatExpandable open={open}>
        <div className="mt-1.5 min-w-0 pl-1.5">{children}</div>
      </NativeChatExpandable>
    </div>
  )
}
