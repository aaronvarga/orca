import { useEffect, useSyncExternalStore } from 'react'
import { useAppStore } from '@/store'
import {
  getCurrentLocalPlatform,
  getRepoExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { readTerminalInventory } from './read-terminal-inventory'
import { reconcileTerminalInventory, type CommandCenterSession } from './terminal-inventory-state'
import type { HostRoute } from '@/runtime/rpc/targets/runtime-client-target'
import {
  installWindowVisibilityInterval,
  isWindowVisible
} from '@/lib/window-activity/window-visibility-interval'
import { buildExecutionHostRegistry } from '../../../../shared/execution-host/execution-host-registry'
import { resolveDashboardCardTerminalInput } from '@/components/dashboard/snapshot/dashboard-card-terminal-input'
import { terminalInventoryProject } from './terminal-inventory-project'

type InventorySnapshot = { sessions: CommandCenterSession[]; refreshing: boolean }
let snapshot: InventorySnapshot = { sessions: [], refreshing: false }
let admittedSessions: CommandCenterSession[] = []
const listeners = new Set<() => void>()
let consumers = 0
let stop: (() => void) | undefined
let inFlight: Promise<void> | undefined
let generation = 0

function publish(next: InventorySnapshot): void {
  snapshot = next
  for (const listener of listeners) {
    listener()
  }
}

function visibleSessions(sessions: CommandCenterSession[]): CommandCenterSession[] {
  const state = useAppStore.getState()
  return sessions.flatMap((session) => {
    const project = terminalInventoryProject(state, session)
    return project
      ? [
          {
            ...session,
            ...project,
            terminalInput: resolveDashboardCardTerminalInput(state, {
              ptyId: session.previewPtyId,
              worktreeId: session.terminal.worktreeId,
              paneKey: `${session.terminal.tabId}:${session.terminal.leafId}`,
              cwd: session.terminal.worktreePath,
              shellOverride: undefined,
              launchAgent: undefined,
              clientPlatform: getCurrentLocalPlatform() ?? 'linux',
              userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
              osRelease: undefined
            })
          }
        ]
      : []
  })
}

export function refreshTerminalInventory(): Promise<void> {
  if (!isWindowVisible() || consumers === 0) {
    return Promise.resolve()
  }
  if (inFlight) {
    return inFlight
  }
  const state = useAppStore.getState()
  const currentGeneration = generation
  const hosts = buildExecutionHostRegistry({
    repos: [
      ...state.repos,
      ...state.projectGroups.map((group) => ({
        connectionId: group.connectionId,
        executionHostId: getRepoExecutionHostId(group)
      }))
    ],
    settings: state.settings,
    runtimeEnvironments: state.runtimeEnvironments,
    runtimeStatusByEnvironmentId: state.runtimeStatusByEnvironmentId
  })
  const routes: HostRoute[] = [{ target: { kind: 'local' }, at: 'local' }]
  for (const host of hosts) {
    if (host.kind === 'runtime' && host.health === 'available') {
      const environmentId = host.id.startsWith('runtime:')
        ? decodeURIComponent(host.id.slice('runtime:'.length))
        : null
      if (environmentId) {
        routes.push({ target: { kind: 'environment', environmentId }, at: 'local' })
      }
    }
  }
  admittedSessions = admittedSessions.map((session) =>
    routes.some(
      (route) =>
        route.target.kind === session.route.target.kind &&
        (route.target.kind === 'local' ||
          (session.route.target.kind === 'environment' &&
            route.target.environmentId === session.route.target.environmentId))
    )
      ? session
      : {
          ...session,
          available: false,
          unavailableReason: 'The owning host is disconnected. Reconnect to use this session.'
        }
  )
  publish({ sessions: visibleSessions(admittedSessions), refreshing: true })
  const promise = Promise.all(
    routes.map(async (route) => {
      try {
        return { route, result: await readTerminalInventory(route) }
      } catch {
        return { route, result: null }
      }
    })
  )
    .then((results) => {
      if (generation !== currentGeneration) {
        return
      }
      let sessions = admittedSessions
      for (const { route, result } of results) {
        sessions = reconcileTerminalInventory(sessions, route, result)
      }
      admittedSessions = sessions
      publish({ sessions: visibleSessions(admittedSessions), refreshing: false })
    })
    .finally(() => {
      if (inFlight === promise) {
        inFlight = undefined
      }
    })
  inFlight = promise
  return promise
}

function retainInventory(): () => void {
  consumers += 1
  if (consumers === 1) {
    const refresh = (): void => {
      void refreshTerminalInventory()
    }
    const stopInterval = installWindowVisibilityInterval({ run: refresh, intervalMs: 5_000 })
    const stopCatalog = useAppStore.subscribe((state, previous) => {
      if (
        state.repos !== previous.repos ||
        state.worktreesByRepo !== previous.worktreesByRepo ||
        state.folderWorkspaces !== previous.folderWorkspaces ||
        state.projectGroups !== previous.projectGroups ||
        state.visibleWorkspaceHostIds !== previous.visibleWorkspaceHostIds ||
        state.workspaceHostScope !== previous.workspaceHostScope ||
        state.runtimeStatusByEnvironmentId !== previous.runtimeStatusByEnvironmentId ||
        state.runtimeEnvironments !== previous.runtimeEnvironments
      ) {
        refresh()
      }
    })
    const stopSpawned = window.api.pty.onSpawned(refresh)
    const stopExited = window.api.pty.onExit(refresh)
    stop = () => {
      stopInterval()
      stopCatalog()
      stopSpawned()
      stopExited()
    }
  }
  return () => {
    consumers -= 1
    if (consumers === 0) {
      generation += 1
      stop?.()
      stop = undefined
      inFlight = undefined
    }
  }
}

export function useTerminalInventory(
  enabled = true
): InventorySnapshot & { refresh: typeof refreshTerminalInventory } {
  useEffect(() => (enabled ? retainInventory() : undefined), [enabled])
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => snapshot
  )
  return { ...value, refresh: refreshTerminalInventory }
}
