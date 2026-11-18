import type { ComponentProps } from 'react'
import { cn } from '@/lib/class-names'

export function ApprovalCard({
  className,
  children,
  ...props
}: ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      {...props}
      className={cn(
        'relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs',
        className
      )}
    >
      {children}
    </div>
  )
}
