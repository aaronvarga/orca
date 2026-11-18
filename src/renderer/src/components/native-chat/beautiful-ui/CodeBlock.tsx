import type { ComponentProps, ReactNode } from 'react'
import { FileCode2 } from 'lucide-react'
import { cn } from '@/lib/class-names'

export function CodeBlock({
  label,
  language,
  actions,
  code,
  wrapped,
  children,
  className,
  ...props
}: ComponentProps<'div'> & {
  label: string | undefined
  language: string | undefined
  actions: ReactNode
  code: string
  wrapped: boolean
}): React.JSX.Element {
  return (
    <div
      {...props}
      className={cn(
        'group/code my-3 min-w-0 max-w-full overflow-hidden rounded-xl border border-chat-code-border bg-chat-code-surface shadow-xs',
        className
      )}
    >
      <div className="flex min-h-10 items-center gap-2 border-b border-chat-code-border px-3">
        <FileCode2 aria-hidden className="size-3.5 shrink-0 text-chat-foreground-faint" />
        <span
          data-code-language={language}
          className="min-w-0 flex-1 truncate font-mono text-xs text-chat-foreground-faint"
        >
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      </div>
      <div className="flex min-w-0">
        {!wrapped && code ? (
          <div
            aria-hidden
            data-native-chat-code-gutter
            className="m-0 select-none whitespace-pre border-r border-chat-code-border bg-chat-code-surface px-3 py-3 text-right font-mono text-chat-code text-chat-foreground-faint"
          >
            {code
              .replace(/\n$/, '')
              .split('\n')
              .map((_, index) => index + 1)
              .join('\n')}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  )
}
