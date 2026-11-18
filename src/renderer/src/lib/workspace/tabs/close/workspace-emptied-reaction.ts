import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../../../shared/workspace/identity/floating-workspace-id'
import { useAppStore } from '../../../../store/index'
import { armFloatingPanelReclaimIntent } from '@/components/floating-terminal/focus/floating-workspace-focus-reclaim'
import { isFloatingWorkspacePanelFocused } from '@/components/floating-terminal/workspace/floating-workspace-terminal-actions'
import { selectFloatingVisibleTabCount } from '@/store/workspaces/floating/floating-workspace-panel-selector'
import { hasSplitLandingGroup } from '@/store/slices/tabs/split-landing-groups'
import { showWorkspaceSessionChooser } from '@/lib/workspace/activation/workspace-session-chooser'

/** Capture panel ownership before prompts/removal blur it; run the captured reaction only after the close lands. */
export function captureWorkspaceEmptiedReaction(
  worktreeId: string,
  options?: { floatingPanelGuestOwned?: boolean }
): () => void {
  // Emptying the floating panel retains keyboard ownership; workspaces show their chooser.
  if (worktreeId === FLOATING_TERMINAL_WORKTREE_ID) {
    const panelOwned =
      options?.floatingPanelGuestOwned === true || isFloatingWorkspacePanelFocused()
    return () => {
      if (panelOwned && selectFloatingVisibleTabCount(useAppStore.getState()) === 0) {
        armFloatingPanelReclaimIntent()
      }
    }
  }
  return () => showChooserIfEmpty(worktreeId)
}

function showChooserIfEmpty(worktreeId: string): void {
  const state = useAppStore.getState()
  if (state.activeWorktreeId !== worktreeId) {
    return
  }
  if (
    state.reconcileWorktreeTabModel(worktreeId).renderableTabCount === 0 &&
    !hasSplitLandingGroup(state, worktreeId)
  ) {
    showWorkspaceSessionChooser(worktreeId)
  }
}
