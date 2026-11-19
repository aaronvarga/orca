import { realpath, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import type { ProjectHostSetupUpdateArgs } from '../../../shared/project/project-types'
import { getRepoExecutionHostId } from '../../../shared/execution-host/execution-host'
import { normalizeRuntimePathForComparison } from '../../../shared/file-access/cross-platform-path'
import { findProjectAtSameRealPath } from './project-realpath-identity'
import { findProjectHostSetup } from '../../../shared/project/host-setup/project-host-setup-target'
import { inspectGitRepoForRegistrationAsync } from '../../git/repositories/discovery/repo-detection'
import type { Store } from '../../persistence/loading-store/store'

type FolderChangeStore = Pick<Store, 'getRepos'> & {
  getProjectHostSetups?: Store['getProjectHostSetups']
}

export async function validateProjectFolderChange(
  store: FolderChangeStore,
  args: ProjectHostSetupUpdateArgs
): Promise<() => void> {
  const setup = findProjectHostSetup(store.getProjectHostSetups?.() ?? [], args)
  const repo = setup?.repoId
    ? store
        .getRepos()
        .find((row) => row.id === setup.repoId && getRepoExecutionHostId(row) === setup.hostId)
    : undefined
  if (!repo || args.updates.path === undefined || args.updates.path === repo.path) {
    return () => {}
  }
  const path = args.updates.path.trim()
  if (!isAbsolute(path) || !(await stat(path).catch(() => null))?.isDirectory()) {
    throw new Error('Choose an existing folder using its full path.')
  }
  if (repo.connectionId) {
    throw new Error('Change this folder from Orca running on its host.')
  }
  const originalPath = repo.path
  if ((args.updates.kind ?? repo.kind ?? 'git') === 'git') {
    const info = await inspectGitRepoForRegistrationAsync(path)
    const roots = await Promise.all(
      [path, info.rootPath].map(async (value) =>
        normalizeRuntimePathForComparison(await realpath(value).catch(() => value))
      )
    )
    if (!info.isRepo || roots[0] !== roots[1]) {
      throw new Error('Choose the top folder of a Git repository for this Git project.')
    }
  }
  const other = await findProjectAtSameRealPath(
    store
      .getRepos()
      .filter(
        (row) => row.id !== repo.id && getRepoExecutionHostId(row) === getRepoExecutionHostId(repo)
      ),
    path
  )
  if (other) {
    throw new Error('That folder is already used by another project on this host.')
  }
  return () => {
    const current = store
      .getRepos()
      .find(
        (row) => row.id === repo.id && getRepoExecutionHostId(row) === getRepoExecutionHostId(repo)
      )
    if (!current || current.path !== originalPath) {
      throw new Error('The project changed while checking the folder. Try again.')
    }
  }
}
