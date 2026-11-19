import { cn } from '@/lib/class-names'

/** A card above the composer for the thread goal, temporary worker or MCP tray. */
export function NativeChatComposerTabStrip({
  children,
  layout = 'row',
  attached = false,
  ...dataAttributes
}: {
  children: React.ReactNode
  attached?: boolean
  /** `row` lays out one padded line; `stack` leaves the children to lay out a header and body. */
  layout?: 'row' | 'stack'
} & Record<`data-${string}`, string>): React.JSX.Element {
  return (
    <div
      className={cn(
        'group/goal @container/composer-field shrink-0 [--composer-atomic-width:calc(var(--spacing)*10)]',
        attached && 'relative -mb-2'
      )}
      data-native-chat-composer-tab-strip=""
      {...dataAttributes}
    >
      <div
        className={cn(
          'native-chat-composer-gutter pt-2',
          attached && 'group-[[data-native-chat-background-tasks]+&]/goal:pt-0'
        )}
      >
        <div className={cn('mx-auto w-full max-w-(--chat-content-max-width)', attached && 'px-2')}>
          <div
            className={cn(
              'text-xs text-muted-foreground',
              attached
                ? 'rounded-t-md border border-b-0 border-border bg-muted/30 group-[[data-native-chat-background-tasks]+&]/goal:rounded-t-none group-[[data-native-chat-background-tasks]+&]/goal:border-t-0'
                : 'rounded-xl border border-border bg-card shadow-xs',
              layout === 'row' ? 'flex items-start gap-2 py-1 pr-1 pl-3' : 'flex flex-col'
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
