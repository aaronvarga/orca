import type { ComponentProps, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/class-names'

export function StreamingText({
  agentName,
  children,
  className,
  ...props
}: ComponentProps<'div'> & { agentName?: string }): ReactNode {
  return (
    <div {...props} className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      {agentName ? (
        <div className="flex items-center gap-2 text-xs font-medium text-chat-foreground">
          <Sparkles aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{agentName}</span>
        </div>
      ) : null}
      {children}
    </div>
  )
}
