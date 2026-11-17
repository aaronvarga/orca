import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { readRuntimeDirectory } from '@/runtime/files/reads/runtime-directory-read'
import { browseRuntimeServerDirectory } from '@/runtime/files/reads/runtime-server-directory-browser'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/rpc/targets/runtime-client-target'
import { showWorkspaceSessionChooser } from '@/lib/workspace/activation/workspace-session-chooser'
import { activateAndRevealWorkspaceWithOutcome } from '@/lib/workspace/activation/worktree-activation'
import { normalizeRuntimePathForComparison } from '../../../../shared/file-access/cross-platform-path'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { folderWorkspaceKey } from '../../../../shared/workspace/identity/workspace-scope'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'

export async function readFolderGroupDirectory(group: ProjectGroup, path: string) {
  const target = ipcOrRuntimeTargetForHostId(getRepoExecutionHostId(group))
  if (!target) {
    throw new Error(
      translate('sidebar.folderGroupHostUnavailable', 'The folder group host is unavailable.')
    )
  }
  const entries =
    target.kind === 'environment'
      ? (await browseRuntimeServerDirectory(target.environmentId, path)).entries
      : await readRuntimeDirectory(
          {
            target,
            worktreeId: null,
            worktreePath: group.parentPath,
            connectionId: group.connectionId ?? undefined
          },
          path,
          { followSymlinks: true, wakeWslDistro: true }
        )
  return entries
    .filter((entry) => entry.isDirectory && !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function openFolderGroupDirectory(group: ProjectGroup, path: string): Promise<void> {
  const hostId = getRepoExecutionHostId(group)
  const target = ipcOrRuntimeTargetForHostId(hostId)
  if (!target) {
    throw new Error(
      translate('sidebar.folderGroupHostUnavailable', 'The folder group host is unavailable.')
    )
  }
  const state = useAppStore.getState()
  const existing = selectFolderWorkspaces(state).find(
    (workspace) =>
      workspace.projectGroupId === group.id &&
      !workspace.isArchived &&
      getRepoExecutionHostId(workspace) === hostId &&
      normalizeRuntimePathForComparison(workspace.folderPath) ===
        normalizeRuntimePathForComparison(path)
  )
  const created = existing
    ? null
    : await state.createFolderWorkspace(
        {
          projectGroupId: group.id,
          initialSurface: 'chooser',
          folderPath: path,
          connectionId: group.connectionId
        },
        { runtimeEnvironmentId: target.kind === 'environment' ? target.environmentId : null }
      )
  const workspace = existing ?? created?.folderWorkspace
  if (!workspace) {
    throw new Error(
      translate('sidebar.folderGroupOpenFailed', 'The folder could not be opened on its host.')
    )
  }
  const id = folderWorkspaceKey(workspace.id)
  showWorkspaceSessionChooser(id)
  const outcome = activateAndRevealWorkspaceWithOutcome(id, {
    executionHostId: hostId,
    navigationIntent: 'user-open',
    providesInitialSurface: true
  })
  if ('refused' in outcome) {
    throw new Error(
      translate('sidebar.folderGroupOpenFailed', 'The folder could not be opened on its host.')
    )
  }
}
