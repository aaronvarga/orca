import { beforeEach, expect, it, vi } from 'vitest'
import { launchOrcaForkUpdate } from './launch-orca-fork-update'

const boundary = vi.hoisted(() => ({
  launch: vi.fn(),
  reveal: vi.fn(),
  state: {
    repos: [
      {
        id: 'fork',
        path: '/projects/orca',
        displayName: 'Orca',
        addedAt: 0,
        badgeColor: '',
        gitRemoteIdentity: { canonicalKey: 'github.com/aaronvarga/orca' }
      }
    ],
    fetchWorktrees: vi.fn(),
    allWorktrees: () => [
      { id: 'remote', repoId: 'fork', path: '/projects/orca', hostId: 'ssh:server' },
      { id: 'local', repoId: 'fork', path: '/projects/orca', hostId: 'local' }
    ],
    tabsByWorktree: {},
    unifiedTabsByWorktree: {}
  }
}))
vi.mock('@/store/index', () => ({ useAppStore: { getState: () => boundary.state } }))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTabWithOutcome: boundary.launch
}))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktreeWithOutcome: boundary.reveal
}))
beforeEach(() => {
  vi.clearAllMocks()
  boundary.launch.mockReturnValue({ surface: { kind: 'local-terminal', tabId: 'update' } })
})
it('opens the update in the local fork even when a remote twin is listed first', async () => {
  await launchOrcaForkUpdate('v1.4.215')
  expect(boundary.launch).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'codex',
      requestedSurface: 'terminal',
      worktreeId: 'local',
      workspaceExecutionHostId: 'local'
    })
  )
})
it('reports failure when the agent launcher refuses the session', async () => {
  boundary.launch.mockReturnValue({ refused: true })
  await expect(launchOrcaForkUpdate('v1.4.215')).rejects.toThrow('Unable to open Codex')
})
