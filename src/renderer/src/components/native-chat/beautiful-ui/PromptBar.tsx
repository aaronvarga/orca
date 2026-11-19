import type { ReactNode } from 'react'
import { cn } from '@/lib/class-names'

export function PromptBar({
  expanded,
  launch,
  glowing,
  children
}: {
  expanded: boolean
  launch: boolean
  glowing?: boolean
  children: ReactNode
}): React.JSX.Element {
  return (
    <div
      data-expanded={expanded}
      className={cn(
        'group/composer relative isolate flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs [contain:paint]',
        glowing && 'native-chat-composer-glow',
        expanded ? 'gap-2.5 p-3.5' : 'gap-1.5 p-1.5',
        launch
          ? 'border-foreground/10 bg-background dark:bg-foreground/[0.04]'
          : 'native-chat-composer-card'
      )}
    >
      {children}
    </div>
  )
}
