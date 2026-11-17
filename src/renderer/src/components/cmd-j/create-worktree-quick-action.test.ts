import { expect, it, vi } from 'vitest'
import type { CmdJQuickActionContext } from './quick-action-context'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/i18n/localized-catalog', () => ({
  createLocalizedCatalog: (factory: () => unknown) => factory
}))
vi.mock('@/lib/source-control/graph/git-graph-tab', () => ({
  gitGraphSupport: vi.fn(),
  openGitGraph: vi.fn()
}))
vi.mock('./native-chat-split-quick-actions', () => ({ getNativeChatSplitQuickActions: () => [] }))
vi.mock('./quick-action-context', () => ({
  getCurrentWorkspaceActionAvailability: vi.fn(),
  getBrowserWorkspaceActionAvailability: vi.fn(),
  getWorkspaceScopedActionAvailability: vi.fn()
}))
import { getCmdJQuickActions } from './quick-actions'

it('keeps Create Worktree isolated when it opens the ordinary session composer', async () => {
  const openCreateWorkspace = vi.fn()
  const context: CmdJQuickActionContext = {
    activeView: 'terminal',
    activeWorktreeId: null,
    activeWorktree: null,
    isLoading: false,
    sshStatus: null,
    runtimeMode: 'local-desktop',
    activeGroupId: null,
    openNewBrowserTab: vi.fn(),
    openBrowserUrl: vi.fn(),
    openNewMarkdownFile: vi.fn(),
    openNewTerminalTab: vi.fn(),
    openCreateWorkspace,
    deleteActiveWorkspace: vi.fn(),
    openAddQuickCommand: vi.fn()
  }
  const action = getCmdJQuickActions().find((candidate) => candidate.id === 'create-workspace')
  await action?.run(context)
  expect(openCreateWorkspace).toHaveBeenCalledWith('new-worktree')
})
