import type { PersistedState } from '../../../shared/orca-profiles/persisted-state-types'
import type { Repo } from '../../../shared/repository/repo-types'
import { getRepoExecutionHostId } from '../../../shared/execution-host/execution-host'
import { normalizeRuntimePathForComparison } from '../../../shared/file-access/cross-platform-path'
import {
  FOLDER_WORKSPACE_INSTANCE_SEPARATOR,
  getRepoMainWorktreeId,
  rewriteWorktreeIdPath
} from '../../../shared/worktree/id'
import {
  composeWorktreeHostIdentity,
  getExecutionHostIdFromWorktreeHostIdentity,
  getWorktreeIdFromHostIdentity,
  hostWorktreeTarget
} from '../../../shared/worktree/host-qualified-identity'
import { migrateWorktreeIdentity } from './worktree-identity-migration'
import { migrateWorktreeMetadataLocator } from '../loading-store/worktree-metadata/worktree-identity-metadata'
import { ownsRawIdBucket } from '../loading-store/workspace-lineage/metadata-lineage-operations'

export function repointProjectFolder(
  state: PersistedState,
  repo: Repo,
  path: string,
  kind = repo.kind ?? 'git'
) {
  const hostId = getRepoExecutionHostId(repo)
  const destination = path.trim()
  if (!destination) {
    throw new Error('Choose a project folder.')
  }
  if (
    state.repos.some(
      (other) =>
        other !== repo &&
        getRepoExecutionHostId(other) === hostId &&
        normalizeRuntimePathForComparison(other.path) ===
          normalizeRuntimePathForComparison(destination)
    )
  ) {
    throw new Error('That folder is already used by another project on this host.')
  }
  // shortcut: identity migration spans hosts; reject same-path twins until migration is host-scoped.
  if (
    state.repos.some(
      (other) =>
        other.id === repo.id && getRepoExecutionHostId(other) !== hostId && other.path === repo.path
    )
  ) {
    throw new Error(
      'This project shares its folder identity with another host. Re-import it at the new location instead.'
    )
  }
  const root = getRepoMainWorktreeId(repo)
  const ids = new Set([
    root,
    ...Object.keys(state.worktreeMeta),
    ...Object.keys(state.worktreeIdentityAliases ?? {})
      .filter((key) => getExecutionHostIdFromWorktreeHostIdentity(key) === hostId)
      .map(getWorktreeIdFromHostIdentity),
    ...Object.keys(state.workspaceSession.unifiedTabs ?? {}),
    ...Object.keys(state.workspaceSessionsByHostId?.[hostId]?.unifiedTabs ?? {})
  ])
  const renamedWorktrees = [...ids]
    .filter((id) => id === root || id.startsWith(`${root}${FOLDER_WORKSPACE_INSTANCE_SEPARATOR}`))
    .map((oldWorktreeId) => ({
      oldWorktreeId,
      newWorktreeId: rewriteWorktreeIdPath(oldWorktreeId, () => destination)
    }))
    .filter(({ oldWorktreeId, newWorktreeId }) => oldWorktreeId !== newWorktreeId)
  if (kind !== (repo.kind ?? 'git')) {
    const prefix = `${repo.id}::`
    const extra = [...ids].filter((id) => id.startsWith(prefix) && id !== root)
    if (extra.length > 0) {
      throw new Error(
        'This project has other saved workspaces. Remove them before changing its type.'
      )
    }
  }
  for (const { newWorktreeId } of renamedWorktrees) {
    if (
      [state.workspaceSession, ...Object.values(state.workspaceSessionsByHostId ?? {})].some(
        (session) =>
          session?.unifiedTabs?.[newWorktreeId] ||
          session?.tabsByWorktree[newWorktreeId] ||
          session?.tabGroups?.[newWorktreeId] ||
          session?.openFilesByWorktree?.[newWorktreeId]
      ) ||
      state.worktreeMeta[newWorktreeId] ||
      state.worktreeIdentityAliases?.[composeWorktreeHostIdentity(hostId, newWorktreeId)]?.length
    ) {
      throw new Error('The destination already has saved workspace state. Choose another folder.')
    }
  }
  for (const { oldWorktreeId, newWorktreeId } of renamedWorktrees) {
    if (ownsRawIdBucket(state, hostWorktreeTarget({ id: oldWorktreeId, hostId }))) {
      migrateWorktreeIdentity(state, oldWorktreeId, newWorktreeId)
    }
    const aliases =
      state.worktreeIdentityAliases?.[composeWorktreeHostIdentity(hostId, oldWorktreeId)] ?? []
    for (const key of aliases) {
      const meta = state.worktreeMetaByIdentity?.[key]
      if (meta) {
        meta.priorWorktreeIds = [...new Set([...(meta.priorWorktreeIds ?? []), oldWorktreeId])]
      }
    }
    migrateWorktreeMetadataLocator(state, oldWorktreeId, newWorktreeId, hostId)
  }
  repo.path = destination
  repo.kind = kind
  delete repo.folderUpgradeGitRootPath
  return renamedWorktrees
}
