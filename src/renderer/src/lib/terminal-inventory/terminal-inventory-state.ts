import type {
  RuntimeTerminalListResult,
  RuntimeTerminalSummary
} from '../../../../shared/terminal/runtime/runtime-terminal-contracts'
import {
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import {
  authorityKey,
  type HostAuthorityKey
} from '../../../../shared/execution-host/host-authority'
import { isFloatingWorkspaceId } from '../../../../shared/workspace/identity/floating-workspace-worktree'
import type { HostRoute } from '@/runtime/rpc/targets/runtime-client-target'
import { toRemoteRuntimePtyId } from '../../../../shared/remote-runtime/remote-runtime-pty-id'
import type { DashboardCardTerminalInput } from '../../../../shared/agent-status/presentation/dashboard-snapshot'

export type CommandCenterSession = {
  id: string
  ownerId: HostAuthorityKey
  route: HostRoute
  terminal: RuntimeTerminalSummary
  available: boolean
  unavailableReason?: string
  repoId?: string
  previewPtyId: string
  terminalInput?: DashboardCardTerminalInput
  projectOwnerId?: ExecutionHostId
  projectGroupId?: string
}

export function inventoryOwner(
  route: HostRoute,
  reported: string | undefined
): HostAuthorityKey | null {
  const host = parseExecutionHostId(reported)
  if (!host) {
    return null
  }
  if (host.kind === 'runtime') {
    return route.target.kind === 'environment' && host.environmentId === route.target.environmentId
      ? host.id
      : null
  }
  return authorityKey({
    endpoint:
      route.target.kind === 'local'
        ? { kind: 'self' }
        : { kind: 'environment', environmentId: route.target.environmentId },
    at: host.id
  })
}

export function reconcileTerminalInventory(
  previous: readonly CommandCenterSession[],
  route: HostRoute,
  census: RuntimeTerminalListResult | null
): CommandCenterSession[] {
  const endpointMatches = (session: CommandCenterSession): boolean =>
    session.route.target.kind === route.target.kind &&
    (session.route.target.kind === 'local' ||
      (route.target.kind === 'environment' &&
        session.route.target.environmentId === route.target.environmentId))
  const complete = Boolean(
    census && !census.truncated && census.terminals.length >= census.totalCount
  )
  const covered = new Set(
    (census?.hostScope?.hostIds ?? [])
      .map((host) => inventoryOwner(route, host))
      .filter((host) => host !== null)
  )
  for (const host of census?.hostScope?.omittedHostIds ?? []) {
    const owner = inventoryOwner(route, host)
    if (owner) {
      covered.delete(owner)
    }
  }
  const next = new Map(
    previous.map((session) => [
      session.id,
      endpointMatches(session)
        ? {
            ...session,
            available: false,
            unavailableReason:
              'The owning host has not confirmed this session. Reconnect or refresh.'
          }
        : session
    ])
  )
  const observed = new Set<string>()
  for (const terminal of census?.terminals ?? []) {
    if (!terminal.ptyId || isFloatingWorkspaceId(terminal.worktreeId)) {
      continue
    }
    const confirmedOwnerId = inventoryOwner(route, terminal.executionHostId)
    const reportedHost = parseExecutionHostId(terminal.executionHostId)
    const ownerId = confirmedOwnerId ?? inventoryOwner(route, 'local')!
    const id = JSON.stringify([ownerId, terminal.ptyId, terminal.incarnationId ?? null])
    observed.add(id)
    if (terminal.verdict === 'exited') {
      next.delete(id)
      continue
    }
    const available =
      confirmedOwnerId !== null &&
      covered.has(ownerId) &&
      terminal.verdict === 'live' &&
      terminal.connected &&
      Boolean(terminal.incarnationId) &&
      reportedHost?.kind !== 'ssh'
    next.set(id, {
      id,
      ownerId,
      route: {
        target: route.target,
        at: reportedHost?.kind === 'ssh' ? reportedHost.id : 'local'
      },
      terminal,
      available,
      previewPtyId:
        route.target.kind === 'environment'
          ? toRemoteRuntimePtyId(terminal.handle, route.target.environmentId)
          : terminal.ptyId,
      ...(available
        ? {}
        : {
            unavailableReason:
              reportedHost?.kind === 'ssh'
                ? 'This SSH host cannot safely end an exact terminal incarnation. Open the session on its owning host, or update the host to enable protected session controls.'
                : 'The host could not verify this terminal identity and liveness. Reconnect or update its Orca host.'
          })
    })
  }
  if (complete) {
    for (const [id, session] of next) {
      if (endpointMatches(session) && covered.has(session.ownerId) && !observed.has(id)) {
        next.delete(id)
      }
    }
  }
  return [...next.values()]
}
