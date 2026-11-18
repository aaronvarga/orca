import type { ReactNode } from 'react'
import { cn } from '@/lib/class-names'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useNativeChatDisclosure } from '../messages/disclosure/native-chat-disclosure-store'

export function TaskRow({
  icon,
  status,
  active,
  tone = 'neutral',
  details,
  disclosureKey,
  children
}: {
  icon: ReactNode
  status: ReactNode
  active: boolean
  tone?: 'neutral' | 'success' | 'error'
  details?: ReactNode
  disclosureKey?: string
  children: ReactNode
}): React.JSX.Element {
  const { open, setOpen } = useNativeChatDisclosure(disclosureKey, false)
  const header = (
    <>
      <span className="col-start-1 row-start-1 flex size-6 shrink-0 items-center justify-center text-muted-foreground">
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
      <Badge
        variant="taskStatus"
        data-tone={tone}
        className="col-start-2 row-start-2 max-w-full justify-self-start break-words text-left @sm/task:max-w-1/2"
      >
        {status}
      </Badge>
      {details ? (
        <ChevronDown
          aria-hidden
          className={cn(
            'col-start-3 row-start-1 size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
        />
      ) : null}
    </>
  )
  const rowClass =
    'grid min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 px-3 py-2 text-left text-sm text-card-foreground @sm/task:flex'
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
