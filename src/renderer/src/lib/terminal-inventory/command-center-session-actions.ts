import type {
  RuntimeTerminalClose,
  RuntimeTerminalListResult
} from '../../../../shared/terminal/runtime/runtime-terminal-contracts'
import {
  captureHostIdentityFence,
  isHostIdentityFenceCurrent
} from '@/runtime/rpc/environment-revisions/host-identity-fence'
import { callHostRoute } from '@/runtime/rpc/calls/host-route-call'
import { useAppStore } from '@/store'
import { useRunningTerminalCloseConfirmStore } from '@/store/slices/tabs/closing/running-terminal-close-confirm'
import { revealTerminalPane } from '@/lib/workspace/activation/reveal-terminal-pane'
import { parseExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { readTerminalInventory } from './read-terminal-inventory'
import type { CommandCenterSession } from './terminal-inventory-state'
import { refreshTerminalInventory } from './use-terminal-inventory'
import { parseHostAuthorityKey } from '../../../../shared/execution-host/host-authority'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import type { RuntimeMobileSessionTabsResult } from '../../../../shared/remote-runtime/session-graph/runtime-session-contracts'
import {
  guardPinnedTabClose,
  isUnifiedTabPinned
} from '@/store/slices/tabs/closing/pinned-tab-close-guard'
import { resolveTerminalTabPtyOwnership } from '@/lib/workspace/tabs/terminal-tab-for-pty-id'

async function revalidateSession(
  session: CommandCenterSession
): Promise<RuntimeTerminalListResult> {
  if (!session.available || !session.terminal.incarnationId) {
    throw new Error(session.unavailableReason ?? 'Reconnect this terminal first.')
  }
  const census = await readTerminalInventory(session.route)
  if (
    !census.terminals.some(
      (terminal) =>
        terminal.handle === session.terminal.handle &&
        terminal.ptyId === session.terminal.ptyId &&
        terminal.incarnationId === session.terminal.incarnationId &&
        terminal.verdict === 'live'
    )
  ) {
    throw new Error('This terminal has changed or exited. Refresh before trying again.')
  }
  return census
}

export async function openSessionInProject(session: CommandCenterSession): Promise<void> {
  const owner = parseHostAuthorityKey(session.ownerId)
  if (!owner || (owner.endpoint.kind === 'environment' && owner.at !== 'local')) {
    throw new Error('Open this nested SSH session from its owning Orca host.')
  }
  const navigationHost = parseExecutionHostId(session.ownerId)
  if (!navigationHost) {
    throw new Error('The owning host is unavailable. Reconnect and retry.')
  }
  const fence = captureHostIdentityFence(session.route)
  const census = await revalidateSession(session)
  let terminal = census.terminals.find(
    (candidate) =>
      candidate.ptyId === session.terminal.ptyId &&
      candidate.incarnationId === session.terminal.incarnationId
  )!
  if (terminal.orphaned) {
    const revision = census.topologyRevisions?.[terminal.worktreeId]
    if (revision === undefined) {
      throw new Error(
        'The owning host cannot verify terminal placement. Update its Orca host and retry.'
      )
    }
    const recorded = parsePaneKey(terminal.recordedPaneKey ?? '')
    if (!isHostIdentityFenceCurrent(fence)) {
      throw new Error('The terminal owner changed. Refresh and retry.')
    }
    await callHostRoute(session.route, 'terminal.adoptOrphans', {
      worktree: `id:${terminal.worktreeId}`,
      expectedTopologyRevision: revision,
      claims: [
        {
          terminal: terminal.handle,
          ptyId: terminal.ptyId,
          incarnationId: terminal.incarnationId,
          tabId: recorded?.tabId ?? createNonSecureContextUuid(),
          leafId: recorded?.leafId ?? createNonSecureContextUuid()
        }
      ]
    })
    const placed = await readTerminalInventory(session.route)
    const adopted = placed.terminals.find(
      (candidate) =>
        candidate.ptyId === terminal.ptyId &&
        candidate.incarnationId === terminal.incarnationId &&
        !candidate.orphaned
    )
    if (!adopted) {
      throw new Error(
        'This terminal could not be placed in its project. Reconnect the owning host and retry.'
      )
    }
    terminal = adopted
  }
  if (!isHostIdentityFenceCurrent(fence)) {
    throw new Error('The terminal owner changed. Refresh and retry.')
  }
  const previousView = useAppStore.getState().activeView
  if (
    !revealTerminalPane({
      worktreeId: terminal.worktreeId,
      tabId: terminal.tabId,
      leafId: terminal.leafId,
      executionHostId: navigationHost.id
    })
  ) {
    useAppStore.getState().setActiveView(previousView)
    throw new Error('The project is unavailable. Reconnect its owning host and retry.')
  }
}

export async function requestEndSession(session: CommandCenterSession): Promise<void> {
  const fence = captureHostIdentityFence(session.route)
  await revalidateSession(session)
  const tabs = await callHostRoute<RuntimeMobileSessionTabsResult>(
    session.route,
    'session.tabs.list',
    { worktree: `id:${session.terminal.worktreeId}` }
  )
  if (!isHostIdentityFenceCurrent(fence)) {
    throw new Error('The terminal owner changed. Refresh and retry.')
  }
  const hostTab = tabs.tabs.find(
    (tab) =>
      tab.type === 'terminal' &&
      (tab.parentTabId === session.terminal.tabId ||
        (tab.ptyId === session.terminal.ptyId &&
          tab.incarnationId === session.terminal.incarnationId))
  )
  const state = useAppStore.getState()
  const localBinding =
    session.route.target.kind === 'local' && session.route.at === 'local' && session.terminal.ptyId
      ? resolveTerminalTabPtyOwnership(state, session.terminal.worktreeId, session.terminal.ptyId)
      : null
  const pinned =
    hostTab?.isPinned === true ||
    (localBinding?.kind === 'owned' &&
      localBinding.tabId === session.terminal.tabId &&
      isUnifiedTabPinned(state, session.terminal.worktreeId, session.terminal.tabId))
  return new Promise((resolve, reject) => {
    guardPinnedTabClose({
      isPinned: pinned,
      tabLabel:
        hostTab?.title ?? session.terminal.paneTitle ?? session.terminal.title ?? 'Terminal',
      onCancel: resolve,
      onClose: () => {
        useRunningTerminalCloseConfirmStore.getState().requestRunningTerminalCloseConfirm({
          terminalTabId: session.id,
          copyKind: session.terminal.agentIdentity ? 'agent' : 'command',
          onCancel: resolve,
          onConfirm: () => {
            void (async () => {
              if (!isHostIdentityFenceCurrent(fence)) {
                throw new Error(
                  'The terminal owner changed while confirmation was open. Refresh and retry.'
                )
              }
              await revalidateSession(session)
              if (!isHostIdentityFenceCurrent(fence)) {
                throw new Error('The terminal owner changed. Refresh and retry.')
              }
              const { close } = await callHostRoute<{ close: RuntimeTerminalClose }>(
                session.route,
                'terminal.close',
                {
                  terminal: session.terminal.handle,
                  expectedIncarnationId: session.terminal.incarnationId,
                  ...(pinned ? { force: true } : {})
                }
              )
              if (!close.ptyKilled) {
                throw new Error(
                  'The host could not confirm the session ended. Refresh before retrying.'
                )
              }
              await refreshTerminalInventory()
            })().then(resolve, reject)
          }
        })
      }
    })
  })
}
