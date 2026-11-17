import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/workspaces/selection/use-selected-worktree'
import { useActiveRepo } from '@/store/repos/use-repository-catalog'
import { getResolvedExecutionHostIdForWorktree } from '@/lib/workspace/ownership/resolved-worktree-execution-host'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { FolderPathButton } from '@/components/file-actions/FolderPathButton'

export function WorkspacePathStatusSegment({ compact }: { compact: boolean }) {
  const worktree = useActiveWorktree()
  const repo = useActiveRepo()
  const owner = useAppStore((state) =>
    worktree
      ? (getResolvedExecutionHostIdForWorktree(state, worktree.id) ?? 'unresolved')
      : repo
        ? getRepoExecutionHostId(repo)
        : 'unresolved'
  )
  const path = worktree?.path ?? repo?.path
  return path ? <FolderPathButton path={path} owner={owner} showPath={!compact} /> : null
}
