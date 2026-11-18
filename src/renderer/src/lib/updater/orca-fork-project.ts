import type { Repo } from '../../../../shared/repository/repo-types'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'

export function findOrcaForkProject(repos: readonly Repo[]): Repo | null {
  const candidates = repos.filter((repo) => {
    if (repo.kind === 'folder' || getRepoExecutionHostId(repo) !== 'local') {
      return false
    }
    const identity = repo.gitRemoteIdentity?.canonicalKey.toLowerCase()
    return (
      identity === 'github.com/aaronvarga/orca' ||
      (!!identity &&
        identity !== 'github.com/stablyai/orca' &&
        repo.upstream?.host === 'github.com' &&
        repo.upstream.owner.toLowerCase() === 'stablyai' &&
        repo.upstream.repo.toLowerCase() === 'orca')
    )
  })
  return candidates.length === 1 ? candidates[0] : null
}
