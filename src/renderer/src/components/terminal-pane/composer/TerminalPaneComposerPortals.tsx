import { getKnownExecutionHostIdForWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '@/store'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import type { TerminalPaneController } from '../controller/use-terminal-pane-controller'
import { resolveTerminalInputHostPlatform } from '../input/terminal-input-host-platform'
import { resolveProtectedMultilinePasteOptionsForPane } from '../input/paste/terminal-agent-paste-bracketing'
import { resolveTerminalPasteRuntime } from '../input/paste/terminal-paste-runtime'
import { writeTerminalPastePtyInput } from '../input/paste/terminal-pty-paste-writer'
import { recordTerminalUserInputForLeaf } from '../input/terminal-input-activity'
import { TerminalPaneComposer } from './TerminalPaneComposer'
import { sendTerminalComposerText } from './terminal-composer-send'

type ComposerController = Pick<
  TerminalPaneController,
  | 'worktreeId'
  | 'tabId'
  | 'paneTransportsRef'
  | 'managerRef'
  | 'managedPanes'
  | 'effectiveChatViewMode'
  | 'chatPane'
>

function PaneComposer({ pane, controller }: { pane: ManagedPane; controller: ComposerController }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { worktreeId, tabId, paneTransportsRef, managerRef } = controller
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    const resize = () =>
      pane.container.style.setProperty(
        '--orca-pane-composer-height',
        `${root.getBoundingClientRect().height}px`
      )
    const observer = new ResizeObserver(resize)
    observer.observe(root)
    resize()
    return () => {
      observer.disconnect()
      pane.container.style.removeProperty('--orca-pane-composer-height')
    }
  }, [pane.container])
  const hostId = useAppStore((state) => getKnownExecutionHostIdForWorktree(state, worktreeId))
  return (
    <div
      ref={rootRef}
      data-terminal-composer
      className="absolute inset-x-0 bottom-0 z-10 max-h-[50%] overflow-auto scrollbar-sleek"
    >
      <TerminalPaneComposer
        target={hostId ? { worktreeId, executionHostId: hostId } : undefined}
        sessionKey={JSON.stringify([worktreeId, tabId, pane.leafId])}
        onFocusTerminal={() => pane.terminal.focus()}
        onSend={async (text, submit) => {
          const transport = paneTransportsRef.current.get(pane.id)
          const ptyId = transport?.getPtyId()
          const isCurrent = () =>
            Boolean(
              transport?.isConnected() &&
              !transport.isHoldingInput?.() &&
              transport.getPtyId() === ptyId &&
              paneTransportsRef.current.get(pane.id) === transport &&
              managerRef.current
                ?.getPanes()
                .some(
                  (current) => current.leafId === pane.leafId && current.terminal === pane.terminal
                )
            )
          if (!transport || !ptyId || !isCurrent()) {
            return 'paste-failed'
          }
          const state = useAppStore.getState()
          const platform = resolveTerminalInputHostPlatform({
            clientPlatform: getShortcutPlatform(),
            state,
            worktreeId,
            transport
          })
          const result = await sendTerminalComposerText({
            text,
            submit,
            ptyId,
            runtime: resolveTerminalPasteRuntime({ platform, ptyId, transport }),
            bracketedPasteMode: pane.terminal.modes.bracketedPasteMode,
            pasteOptions: resolveProtectedMultilinePasteOptionsForPane({
              isWindowsClient: platform === 'win32',
              hostPlatform: platform,
              agentStatusByPaneKey: state.agentStatusByPaneKey,
              paneForegroundAgentByPaneKey: state.paneForegroundAgentByPaneKey,
              tabId,
              leafId: pane.leafId
            }),
            isCurrent,
            write: (data, signal) => writeTerminalPastePtyInput(transport, data, 'driving', signal)
          })
          if (result !== 'paste-failed') {
            recordTerminalUserInputForLeaf(tabId, pane.leafId)
          }
          return result
        }}
      />
    </div>
  )
}

export function TerminalPaneComposerPortals({ controller }: { controller: ComposerController }) {
  return (
    <>
      {controller.managedPanes.map((pane) =>
        controller.effectiveChatViewMode && controller.chatPane?.id === pane.id
          ? null
          : createPortal(
              <PaneComposer pane={pane} controller={controller} />,
              pane.container,
              `composer-${pane.leafId}`
            )
      )}
    </>
  )
}
