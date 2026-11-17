import { showWorkspaceSessionChooser } from '@/lib/workspace/activation/workspace-session-chooser'
import { useAppStore } from '@/store'
import { resolveCurrentCheckout } from '@/lib/workspace/creation/current-checkout'
import { activateAndRevealWorkspaceWithOutcome } from '@/lib/workspace/activation/worktree-activation'
import { getWorktreeVisitKey } from '@/lib/workspace/activation/worktree-visit-recency'
import { worktreeOwnerHostIds } from '@/lib/workspace/ownership/workspace-catalog-owner-index'
import { resolveWorktreeOperationRouteResultForHost } from '@/lib/workspace/ownership/worktree-operation-route'
import {
  selectWorktreesByRepo,
  selectFolderWorkspaces
} from '@/store/workspaces/catalog/workspace-record-fields'
import {
  getRepoExecutionHostId,
  toRuntimeExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { buildExecutionHostRegistry } from '../../../../shared/execution-host/execution-host-registry'
import { resolveQualifiedFolderWorkspaceResult } from '../../../../shared/folder-workspaces/folder-workspace-execution-host'
import {
  folderWorkspaceRepoId,
  folderWorkspaceToWorktree
} from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'

export function activateRailProject(
  project: Repo | ProjectGroup,
  currentCheckout = false,
  providesInitialSurface = false
): string | null {
  const state = useAppStore.getState()
  const hostId = getRepoExecutionHostId(project)
  const worktrees =
    'path' in project
      ? (selectWorktreesByRepo(state)[project.id] ?? []).filter(
          (w) => worktreeOwnerHostIds(w).includes(hostId) && !w.isArchived
        )
      : selectFolderWorkspaces(state).flatMap((folder) => {
          if (folder.projectGroupId !== project.id || folder.isArchived) {
            return []
          }
          const owner = resolveQualifiedFolderWorkspaceResult(state, folder.id, hostId)
          return owner.kind === 'selected'
            ? [
                folderWorkspaceToWorktree({
                  ...owner.value.workspace,
                  executionHostId: owner.value.hostId,
                  connectionId: owner.value.connectionId
                })
              ]
            : []
        })
  const lastVisit = (workspaceId: string): number | undefined =>
    state.lastVisitedAtByWorktreeId[getWorktreeVisitKey(workspaceId, hostId)]
  const recent = currentCheckout
    ? undefined
    : worktrees
        .filter((w) => lastVisit(w.id) != null)
        .sort((a, b) => (lastVisit(b.id) ?? 0) - (lastVisit(a.id) ?? 0))[0]
  const checkout =
    'path' in project
      ? project
      : { id: folderWorkspaceRepoId(project.id), path: project.parentPath ?? '' }
  const target = recent ?? resolveCurrentCheckout(worktrees, checkout, hostId)
  if (!target) {
    return 'The configured checkout is unavailable. Reconnect its host or refresh the project.'
  }
  const route = resolveWorktreeOperationRouteResultForHost(state, target.id, hostId)
  if (route.kind !== 'resolved') {
    return 'This workspace owner is unavailable. Refresh the project and retry.'
  }
  const transportHost = route.route.runtimeEnvironmentId
    ? toRuntimeExecutionHostId(route.route.runtimeEnvironmentId)
    : hostId
  const hosts = buildExecutionHostRegistry({
    repos: [
      ...state.repos,
      ...state.projectGroups.map((group) => ({
        connectionId: group.connectionId,
        executionHostId: getRepoExecutionHostId(group)
      }))
    ],
    settings: state.settings,
    sshConnectionStates: state.sshConnectionStates,
    runtimeEnvironments: state.runtimeEnvironments,
    runtimeStatusByEnvironmentId: state.runtimeStatusByEnvironmentId
  })
  const host = hosts.find(
    (entry) => entry.id === transportHost || entry.aliasHostIds?.includes(transportHost)
  )
  if (!host || (host.health !== 'local' && host.health !== 'available')) {
    return 'The workspace host is unavailable. Reconnect it and retry.'
  }
  if (!providesInitialSurface) {
    showWorkspaceSessionChooser(target.id)
  }
  const outcome = activateAndRevealWorkspaceWithOutcome(target.id, {
    executionHostId: hostId,
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
  return 'refused' in outcome
    ? 'The workspace could not be opened. Check its host connection and directory access.'
    : null
}
