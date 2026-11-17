import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { normalizeRuntimePathForComparison } from '../../../../../shared/file-access/cross-platform-path'
import { worktreeOwnerHostIds } from '../ownership/workspace-catalog-owner-index'

export function resolveCurrentCheckout(
  worktrees: readonly Worktree[],
  repo: Pick<Repo, 'id' | 'path'>,
  hostId: ExecutionHostId
): Worktree | null {
  return (
    worktrees.find(
      (worktree) =>
        worktree.repoId === repo.id &&
        worktreeOwnerHostIds(worktree).includes(hostId) &&
        normalizeRuntimePathForComparison(worktree.path) ===
          normalizeRuntimePathForComparison(repo.path)
    ) ?? null
  )
}
