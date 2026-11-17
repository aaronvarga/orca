import { expect, it, vi } from 'vitest'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  launch: vi.fn(() => ({ surface: { kind: 'local-terminal', tabId: 'new-tab' } })),
  activate: vi.fn(() => ({ primaryTabId: null }))
}))
vi.mock('@/store/index', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activate
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTabWithOutcome: mocks.launch
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents', () => ({
  terminalLaunchOpened: vi.fn(async () => true)
}))
vi.mock('@/lib/work-items/linked-work-item-context', () => ({
  getLaunchableWorkItemDraftContent: () => 'Fix issue 123'
}))
vi.mock('./launch-work-item-direct-preflight', () => ({
  resolveDirectProspectiveAgent: vi.fn(async () => ({
    prospectiveAgent: 'claude',
    unavailable: false
  }))
}))
vi.mock('./launch-work-item-direct-messages', () => ({
  directWorkItemFailureReporter: () => () => false,
  unavailableAgentErrorMessage: () => 'Unavailable'
}))
import { launchIssueInCurrentCheckout } from './launch-issue-current-checkout'

type Context = Parameters<typeof launchIssueInCurrentCheckout>[1]

it('opens issue work in the configured owner checkout and preserves its existing task', async () => {
  const primary = makeWorktree({
    id: 'repo::/repo',
    repoId: 'repo',
    path: '/repo',
    branch: 'main',
    isMainWorktree: true,
    hostId: 'ssh:box'
  })
  const checkout = makeWorktree({
    id: 'repo::/linked',
    repoId: 'repo',
    path: '/linked',
    branch: 'feature',
    linkedIssue: 42,
    hostId: 'ssh:box'
  })
  const state = {
    worktreesByRepo: { repo: [primary, checkout] },
    getKnownWorktreeById: () => checkout
  }
  mocks.getState.mockReturnValue(state)
  const context = {
    repo: { id: 'repo', path: '/linked', displayName: 'Repo', badgeColor: '', addedAt: 0 },
    executionHostId: 'ssh:box',
    projectContextPromise: Promise.resolve({ context: undefined })
  } satisfies Context
  const result = await launchIssueInCurrentCheckout(
    {
      item: {
        title: 'New task',
        url: 'https://example.com/issues/123',
        number: 123,
        type: 'issue'
      },
      repoId: 'repo',
      launchSource: 'task_page',
      openModalFallback: vi.fn()
    },
    context
  )
  expect(result).toBe(true)
  expect(mocks.launch).toHaveBeenCalledWith(
    expect.objectContaining({
      worktreeId: 'repo::/linked',
      workspaceExecutionHostId: 'ssh:box',
      initialCwd: '/linked',
      prompt: 'Fix issue 123',
      promptDelivery: 'draft',
      agent: 'claude'
    })
  )
  expect(checkout.linkedIssue).toBe(42)
  expect(checkout.branch).toBe('feature')
})
