import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ReactNode } from 'react'
import { cn } from '@/lib/class-names'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useNativeChatDisclosure } from '../messages/disclosure/native-chat-disclosure-store'

export function TaskRow({
  icon,
  status,
  statusDescription,
  eta,
  active,
  tone = 'neutral',
  details,
  compact = false,
  disclosureKey,
  children
}: {
  icon: ReactNode
  status: ReactNode
  statusDescription?: string
  eta?: ReactNode
  active: boolean
  tone?: 'neutral' | 'progress' | 'success' | 'error'
  compact?: boolean
  details?: ReactNode
  disclosureKey?: string
  children: ReactNode
}): React.JSX.Element {
  const { open, setOpen } = useNativeChatDisclosure(disclosureKey, false)
  const statusChip = (
    <Badge
      variant={eta ? 'taskStatusEta' : 'taskStatus'}
      data-tone={tone}
      className="max-w-full break-words text-left"
    >
      <span>{status}</span>
      {statusDescription ? <span className="sr-only">: {statusDescription}</span> : null}
      {eta ? (
        <span className="rounded-full bg-primary/5 px-1.5 py-0.5 font-mono tabular-nums dark:bg-card/70">
          {eta}
        </span>
      ) : null}
    </Badge>
  )
  const header = (
    <>
      <span
        className={cn(
          'col-start-1 row-start-1 flex shrink-0 items-center justify-center text-muted-foreground',
          compact ? 'size-5' : 'size-6'
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          'col-start-2 row-start-1 min-w-0 flex-1 whitespace-pre-wrap break-words',
          active && 'font-medium'
        )}
      >
        {children}
      </span>
      <span className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center justify-self-start gap-1 @sm/task:ml-auto">
        {statusDescription ? (
          <Tooltip>
            <TooltipTrigger asChild>{statusChip}</TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {statusDescription}
            </TooltipContent>
          </Tooltip>
        ) : (
          statusChip
        )}
      </span>
      <span className="col-start-3 row-start-1 flex size-3.5 shrink-0 items-center justify-center">
        {details ? (
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 text-muted-foreground transition-transform motion-reduce:transition-none',
              open && 'rotate-180'
            )}
          />
        ) : null}
      </span>
    </>
  )
  const rowClass = cn(
    'grid min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 text-left text-sm text-card-foreground @sm/task:flex',
    compact ? 'min-h-8 gap-x-2 gap-y-0.5 px-2 py-1 text-xs' : 'px-3 py-2'
  )
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="@container/task min-w-0">
      {details ? (
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              rowClass,
              'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
            )}
          >
            {header}
          </button>
        </CollapsibleTrigger>
      ) : (
        <div className={rowClass}>{header}</div>
      )}
      {details ? (
        <CollapsibleContent animation="height" data-native-chat-member-detail>
          <div className="mx-3 mb-3 ml-6 border-l border-border pl-5 text-xs text-muted-foreground">
            {details}
          </div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}
