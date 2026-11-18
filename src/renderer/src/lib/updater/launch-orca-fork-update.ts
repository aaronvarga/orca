import { getWorktreeExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { useAppStore } from '@/store/index'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { activateAndRevealWorktreeWithOutcome } from '@/lib/workspace/activation/worktree-activation'
import { findOrcaForkProject } from './orca-fork-project'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import {
  isPrereleaseAppVersion,
  isValidAppVersion
} from '../../../../shared/app-lifecycle/identity/app-version'

export async function launchOrcaForkUpdate(tag: string): Promise<void> {
  if (!isValidAppVersion(tag) || isPrereleaseAppVersion(tag)) {
    throw new Error('Invalid upstream release.')
  }
  const repo = findOrcaForkProject(useAppStore.getState().repos)
  if (!repo) {
    throw new Error('Add a single local Orca fork project before rebasing.')
  }
  await useAppStore
    .getState()
    .fetchWorktrees(repo.id, { executionHostId: 'local', forceLocalOwner: true })
  const state = useAppStore.getState()
  const worktree = state
    .allWorktrees()
    .find(
      (entry) =>
        entry.repoId === repo.id &&
        entry.path === repo.path &&
        !entry.isArchived &&
        getWorktreeExecutionHostId(entry, repo) === 'local'
    )
  if (!worktree) {
    throw new Error('The Orca fork checkout is unavailable. Open its workspace and try again.')
  }
  const label = `Rebase Orca to ${tag}`
  const existing = state.tabsByWorktree[worktree.id]?.find((tab) => tab.quickCommandLabel === label)
  if (existing) {
    activateAndRevealWorktreeWithOutcome(worktree.id, {
      executionHostId: 'local',
      navigationIntent: 'user-open'
    })
    const tab = state.unifiedTabsByWorktree[worktree.id]?.find(
      (entry) => entry.entityId === existing.id && entry.contentType === 'terminal'
    )
    if (tab) {
      state.focusGroup(worktree.id, tab.groupId)
    }
    state.activateTab(existing.id, { worktreeId: worktree.id })
    state.setActiveTabType('terminal', worktree.id)
    return
  }
  const outcome = launchAgentInNewTabWithOutcome({
    requestId: createNonSecureContextUuid(),
    agent: 'codex',
    requestedSurface: 'terminal',
    workspaceExecutionHostId: 'local',
    worktreeId: worktree.id,
    quickCommandLabel: label,
    launchSource: 'unknown',
    prompt: `Rebase my personal Orca fork onto upstream release ${tag} from https://github.com/stablyai/orca/releases/tag/${encodeURIComponent(tag)}. Follow AGENTS.md. Verify the fork and upstream remotes before changing anything. Preserve all fork customizations, commits, and dirty or untracked work. Create a backup ref and preserve dirty work before rebasing, then restore that work. Stay on the existing branch; do not create a feature branch or worktree. Disable rebase.updateRefs so unrelated branches cannot move. Resolve conflicts while retaining fork behavior. Run the relevant checks and pnpm check:changed. Do not push, install, restart the app or server, or stop running terminal or agent sessions. Report the release, backup ref, checks, and remaining limitations.`,
    beforeSurfaceOpen: () => {
      const result = activateAndRevealWorktreeWithOutcome(worktree.id, {
        executionHostId: 'local',
        navigationIntent: 'user-open',
        providesInitialSurface: true
      })
      return 'opened' in result
    }
  })
  if (!outcome || 'refused' in outcome) {
    throw new Error('Unable to open Codex. Check the Codex agent settings and try again.')
  }
}
