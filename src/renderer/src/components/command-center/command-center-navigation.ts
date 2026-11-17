import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { folderWorkspaceRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import type { Repo } from '../../../../shared/repository/repo-types'

export function openProjectCommandCenter(repo: Repo | ProjectGroup): void {
  const state = useAppStore.getState()
  state.setCommandCenterPresentation({
    ...state.commandCenterPresentation,
    project: 'path' in repo ? repo.id : folderWorkspaceRepoId(repo.id),
    host: getRepoExecutionHostId(repo)
  })
  state.openCommandCenter()
}
