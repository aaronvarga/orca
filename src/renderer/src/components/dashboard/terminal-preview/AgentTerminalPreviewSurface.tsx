import type { TerminalComposerTarget } from '../../terminal-pane/composer/terminal-composer-files'
import type { ReactNode, Ref } from 'react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { TerminalPaneComposer } from '../../terminal-pane/composer/TerminalPaneComposer'
import type { TerminalComposerSendResult } from '../../terminal-pane/composer/terminal-composer-send'
import { terminalPreviewUnavailableMessage } from './terminal-preview-unavailable-message'

export function AgentTerminalPreviewSurface({
  ptyId,
  composerSessionKey,
  composerTarget,
  interactive,
  ptyGone,
  className,
  backgroundColor,
  terminalContainerRef,
  onActivate,
  onSend,
  children
}: {
  ptyId: string
  composerSessionKey?: string
  composerTarget?: TerminalComposerTarget
  interactive: boolean
  ptyGone: boolean
  className?: string
  backgroundColor?: string
  terminalContainerRef: Ref<HTMLDivElement>
  onActivate: () => void
  onSend: (text: string, submit: boolean) => Promise<TerminalComposerSendResult>
  children: ReactNode
}) {
  const t = useTranslate()
  return (
    <div
      data-agent-terminal-preview
      onPointerDown={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest('[data-pane-prevent-terminal-focus]')
        ) {
          onActivate()
        }
      }}
      onFocusCapture={(event) => {
        if (
          !(
            event.target instanceof Element &&
            event.target.closest('[data-pane-prevent-terminal-focus]')
          ) &&
          !event.currentTarget.contains(
            event.relatedTarget instanceof Node ? event.relatedTarget : null
          )
        ) {
          onActivate()
        }
      }}
      className={cn(
        'relative flex h-[calc(100vh-140px)] w-full flex-col overflow-hidden bg-background',
        className
      )}
      style={backgroundColor ? { backgroundColor: backgroundColor } : undefined}
    >
      {children}
      {ptyGone ? (
        <div className="absolute inset-0 flex items-center justify-center px-2.5 py-8 text-center text-[11px] text-muted-foreground">
          {terminalPreviewUnavailableMessage({ ptyId }, t)}
        </div>
      ) : null}
      <div
        aria-hidden={ptyGone || undefined}
        className={cn(
          'flex min-h-0 w-full flex-1 items-end overflow-hidden p-1.5',
          ptyGone && 'invisible'
        )}
      >
        <div ref={terminalContainerRef} className="origin-bottom-left" />
      </div>
      {composerSessionKey ? (
        <TerminalPaneComposer
          key={composerSessionKey}
          target={composerTarget}
          sessionKey={composerSessionKey}
          disabled={!interactive || ptyGone}
          onSend={(text, submit) => onSend(text, submit)}
          onFocusTerminal={() => onActivate()}
        />
      ) : null}
    </div>
  )
}
