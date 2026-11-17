import {
  selectWorktreesByRepo,
  selectFolderWorkspaces
} from '@/store/workspaces/catalog/workspace-record-fields'
import {
  getRepoExecutionHostId,
  toRuntimeExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { parseWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import { getRepoIdFromWorktreeId, worktreeIdsEqual } from '../../../../shared/worktree/id'
import { folderWorkspaceRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import { getFolderWorkspaceHostId } from '../../../../shared/folder-workspaces/folder-workspace-host-id'
import { getVisibleSidebarHostIdSet } from '../../../../shared/sidebar-list/hosts/host-filtering'
import type { AppState } from '@/store/types'
import type { CommandCenterSession } from './terminal-inventory-state'

type InventoryProjectState = Pick<
  AppState,
  | 'repos'
  | 'projectGroups'
  | 'folderWorkspaces'
  | 'worktreesByRepo'
  | 'visibleWorkspaceHostIds'
  | 'workspaceHostScope'
>
type InventoryProject = { repoId: string; projectOwnerId: ExecutionHostId; projectGroupId?: string }

export function terminalInventoryProject(
  state: InventoryProjectState,
  session: CommandCenterSession
): InventoryProject | null {
  const logicalHost =
    session.route.target.kind === 'environment'
      ? toRuntimeExecutionHostId(session.route.target.environmentId)
      : session.route.at
  const visible = getVisibleSidebarHostIdSet(
    state.visibleWorkspaceHostIds,
    state.workspaceHostScope
  )
  const catalogHosts: ExecutionHostId[] =
    session.route.at === 'local' ? [logicalHost] : [logicalHost, session.route.at]
  if (visible && !catalogHosts.some((host) => visible.has(host))) {
    return null
  }
  const scope = parseWorkspaceKey(session.terminal.worktreeId)
  if (scope?.type === 'folder') {
    const workspace = selectFolderWorkspaces(state).find(
      (candidate) =>
        candidate.id === scope.folderWorkspaceId &&
        catalogHosts.includes(getFolderWorkspaceHostId(candidate, state.projectGroups))
    )
    if (!workspace) {
      return null
    }
    const project = state.projectGroups.find(
      (candidate) =>
        candidate.id === workspace.projectGroupId &&
        catalogHosts.includes(getRepoExecutionHostId(candidate))
    )
    return project
      ? {
          repoId: folderWorkspaceRepoId(project.id),
          projectOwnerId: getRepoExecutionHostId(project),
          projectGroupId: project.id
        }
      : null
  }
  const repoId = getRepoIdFromWorktreeId(session.terminal.worktreeId)
  if (session.route.target.kind === 'environment' && session.route.at !== 'local') {
    const environmentId = session.route.target.environmentId
    if (
      !(selectWorktreesByRepo(state)[repoId] ?? []).some(
        (worktree) =>
          worktreeIdsEqual(worktree.id, session.terminal.worktreeId) &&
          worktree.runtimeOwnerEnvironmentId === environmentId &&
          worktree.hostId === session.route.at
      )
    ) {
      return null
    }
  }
  const repo = catalogHosts.flatMap((host) =>
    state.repos.filter(
      (candidate) => candidate.id === repoId && getRepoExecutionHostId(candidate) === host
    )
  )[0]
  return repo && !repo.hiddenAt ? { repoId, projectOwnerId: getRepoExecutionHostId(repo) } : null
}
