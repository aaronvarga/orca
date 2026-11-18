import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/class-names'

export function ThinkingState({
  label,
  icon,
  open,
  onOpenChange,
  children
}: {
  label: ReactNode
  icon: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group/reasoning flex min-h-8 w-fit max-w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm font-medium text-chat-foreground-faint transition-colors hover:bg-accent/20 hover:text-chat-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
        >
          {icon}
          <span className="min-w-0 truncate">{label}</span>
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent animation="height" data-native-chat-member-detail>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
