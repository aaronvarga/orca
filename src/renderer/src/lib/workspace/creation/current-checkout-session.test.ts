import { beforeEach, expect, it, vi } from 'vitest'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import type { WorktreeCreationRequest } from './pending-worktree-creation'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  activate: vi.fn(() => ({ primaryTabId: null })),
  launch: vi.fn(),
  shell: vi.fn(),
  structured: vi.fn()
}))
vi.mock('@/store/index', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('../activation/worktree-activation', () => ({ activateAndRevealWorktree: mocks.activate }))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTabWithOutcome: mocks.launch
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents', () => ({
  terminalLaunchOpened: vi.fn(async () => true)
}))
vi.mock('@/lib/agent-session/launch/routing/agent-session-launch-plan', () => ({
  adoptAgentSessionLaunchVerdict: (value: unknown) => value
}))
vi.mock('@/store/terminals/tabs/creation/terminal-active-workspace-creation', () => ({
  openNewTerminalTabInWorkspace: mocks.shell
}))
vi.mock('./worktree-creation-structured-session', () => ({
  launchStructuredWorktreeSession: mocks.structured
}))
import { launchCurrentCheckoutSession } from './current-checkout-session'

const request: WorktreeCreationRequest = {
  repoId: 'repo',
  name: 'unused-name',
  agent: null,
  setupDecision: 'skip',
  pendingFirstAgentMessageRename: false,
  note: 'Do not replace the existing note',
  startupPlan: null,
  quickPrompt: '',
  quickTelemetry: null,
  launchLocation: {
    kind: 'current-checkout',
    worktreeId: 'repo::/linked',
    path: '/linked',
    hostId: 'ssh:box'
  }
}

beforeEach(() => vi.clearAllMocks())

it('launches in the captured linked checkout without rewriting workspace metadata or creating a checkout', async () => {
  const checkout = makeWorktree({
    id: 'repo::/linked',
    repoId: 'repo',
    path: '/linked',
    branch: 'feature',
    comment: 'Existing note',
    linkedIssue: 42,
    hostId: 'ssh:box'
  })
  const state = {
    pendingWorktreeCreations: { launch: { request } },
    getKnownWorktreeById: vi.fn(() => checkout),
    removePendingWorktreeCreation: vi.fn(),
    createWorktree: vi.fn(),
    updateWorktreeMeta: vi.fn()
  }
  mocks.getState.mockReturnValue(state)
  await launchCurrentCheckoutSession('launch', request)
  expect(state.getKnownWorktreeById).toHaveBeenCalledWith('repo::/linked', 'ssh:box')
  expect(mocks.shell).toHaveBeenCalledWith(mocks.getState, 'repo::/linked')
  expect(checkout).toMatchObject({
    path: '/linked',
    branch: 'feature',
    comment: 'Existing note',
    linkedIssue: 42
  })
  expect(state.createWorktree).not.toHaveBeenCalled()
  expect(state.updateWorktreeMeta).not.toHaveBeenCalled()
})

it('refuses retry when its captured checkout disappears instead of opening another path', async () => {
  mocks.getState.mockReturnValue({
    pendingWorktreeCreations: { launch: { request } },
    getKnownWorktreeById: () =>
      makeWorktree({ id: 'repo::/linked', repoId: 'repo', path: '/other' })
  })
  await expect(launchCurrentCheckoutSession('launch', request)).rejects.toThrow(
    'selected checkout is unavailable'
  )
  expect(mocks.shell).not.toHaveBeenCalled()
})

it('does not launch after cancellation', async () => {
  mocks.getState.mockReturnValue({ pendingWorktreeCreations: {} })
  await launchCurrentCheckoutSession('launch', request)
  expect(mocks.shell).not.toHaveBeenCalled()
  expect(mocks.launch).not.toHaveBeenCalled()
})
