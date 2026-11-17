import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import type { WorktreeSlice } from '@/store/slices/worktrees/worktree-slice-contract'
import { createCreateWorktree } from '@/store/slices/worktrees/create/create-worktree'
import { createFolderWorkspaceCreateAction } from '@/store/folder-workspaces/folder-workspace-creation'
import { persistWorktreeMeta } from '@/store/slices/worktrees/metadata/worktree-meta-persist'
import { createFolderWorkspaceMutationActions } from '@/store/folder-workspaces/folder-workspace-mutations'
import { makeFolderWorkspace } from '@/store/folder-workspaces/folder-workspace.test-fixture'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { launchCurrentCheckoutSession } from '@/lib/workspace/creation/current-checkout-session'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  proof: vi.fn(),
  rpc: vi.fn(),
  mutate: vi.fn(),
  launch: vi.fn(),
  set: vi.fn()
}))
vi.mock('@/store/index', () => ({ useAppStore: { getState: mocks.get } }))
vi.mock('../rpc/compatibility/runtime-capability-proof', () => ({
  assertRuntimeEnvironmentCapability: mocks.proof
}))
vi.mock('../rpc/calls/runtime-rpc-call', () => ({ callRuntimeRpc: mocks.rpc }))
vi.mock('@/store/terminals/tabs/creation/terminal-active-workspace-creation', () => ({
  openNewTerminalTabInWorkspace: mocks.launch
}))
const linked = {
  provider: 'azure-devops' as const,
  type: 'issue' as const,
  number: 42,
  title: 'Task',
  url: 'https://dev.azure.com/alpha/project/_workitems/edit/42'
}
const source = {
  kind: 'task-source' as const,
  provider: 'azure-devops' as const,
  projectId: 'orca-project',
  hostId: 'local' as const,
  providerIdentity: {
    provider: 'azure-devops' as const,
    connectionId: 'connection',
    baseUrl: 'https://dev.azure.com/alpha',
    projectId: 'project'
  }
}
const target = { kind: 'environment' as const, environmentId: 'old-destination' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.proof.mockReset().mockImplementation(async (_host, capability) => {
    if (capability === 'azure-devops.tasks.v1') {
      throw new Error('unsupported destination')
    }
  })
  vi.stubGlobal('window', {
    api: {
      worktrees: { create: mocks.mutate, updateMeta: mocks.mutate },
      folderWorkspaces: { create: mocks.mutate, update: mocks.mutate }
    }
  })
})
afterEach(() => vi.unstubAllGlobals())
it('rejects managed worktree creation before filesystem or RPC mutations', async () => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: capability rejection precedes all state reads except sortBy with an explicit destination.
  const get = () => ({ sortBy: 'name' }) as AppState
  const create = createCreateWorktree(mocks.set, get)
  const args: Parameters<WorktreeSlice['createWorktree']> = ['repo', 'new']
  args[25] = {
    executionHostId: 'runtime:old-destination',
    linkedWorkItem: linked,
    linkedTaskSourceContext: source
  }
  await expect(create(...args)).rejects.toThrow()
  expect(mocks.mutate).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(mocks.set).not.toHaveBeenCalled()
})
it('rejects folder creation and metadata/attachment updates on an older destination', async () => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: creation rejects its capability before reading store state.
  const create = createFolderWorkspaceCreateAction(mocks.set, () => ({}) as AppState)
  await expect(
    create(
      { projectGroupId: 'group', linkedTask: linked, linkedTaskSourceContext: source },
      { runtimeEnvironmentId: 'old-destination' }
    )
  ).rejects.toThrow()
  await expect(
    persistWorktreeMeta(target, 'worktree', {
      linkedWorkItem: linked,
      linkedTaskSourceContext: source
    })
  ).rejects.toThrow()
  await expect(
    persistWorktreeMeta(target, 'worktree', {
      linkedItems: [{ ...linked, taskSourceContext: source }]
    })
  ).rejects.toThrow()
  expect(mocks.mutate).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(mocks.set).not.toHaveBeenCalled()
})
it('rejects folder linked-task updates even when linkedItems is absent', async () => {
  const folder = makeFolderWorkspace({ executionHostId: 'runtime:old-destination' })
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the owner lookup needs the folder catalog; the gate rejects before other mutations.
  const get = () => ({ folderWorkspaces: [folder], projectGroups: [] }) as unknown as AppState
  const actions = createFolderWorkspaceMutationActions(mocks.set, get)
  await expect(
    actions.updateFolderWorkspace(
      folder.id,
      { linkedTask: linked, linkedTaskSourceContext: source },
      { executionHostId: 'runtime:old-destination' }
    )
  ).rejects.toThrow()
  expect(mocks.mutate).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(mocks.set).not.toHaveBeenCalled()
})
it('retains the pending current-checkout draft without updating links or starting a session', async () => {
  const request: WorktreeCreationRequest = {
    repoId: 'repo',
    name: 'Task',
    agent: null,
    setupDecision: 'skip',
    pendingFirstAgentMessageRename: false,
    note: 'User instruction',
    startupPlan: null,
    quickPrompt: '',
    quickTelemetry: null,
    linkedWorkItem: linked,
    linkedTaskSourceContext: source,
    launchLocation: {
      kind: 'current-checkout',
      hostId: 'runtime:old-destination',
      worktreeId: 'checkout',
      path: '/checkout'
    }
  }
  const pending = { request }
  const state = {
    pendingWorktreeCreations: { launch: pending },
    getKnownWorktreeById: () =>
      makeWorktree({
        id: 'checkout',
        repoId: 'repo',
        path: '/checkout',
        hostId: 'runtime:old-destination'
      }),
    updateWorktreeMeta: mocks.mutate,
    removePendingWorktreeCreation: mocks.mutate
  }
  mocks.get.mockReturnValue(state)
  await expect(launchCurrentCheckoutSession('launch', request)).rejects.toThrow()
  expect(state.pendingWorktreeCreations.launch).toBe(pending)
  expect(request.note).toBe('User instruction')
  expect(mocks.mutate).not.toHaveBeenCalled()
  expect(mocks.launch).not.toHaveBeenCalled()
})

it('does not attach a link after cancellation during the destination capability check', async () => {
  let finish!: () => void
  mocks.proof.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  const request: WorktreeCreationRequest = {
    repoId: 'repo',
    name: 'Task',
    agent: null,
    setupDecision: 'skip',
    pendingFirstAgentMessageRename: false,
    note: 'Keep my draft',
    startupPlan: null,
    quickPrompt: '',
    quickTelemetry: null,
    linkedWorkItem: linked,
    linkedTaskSourceContext: source,
    launchLocation: {
      kind: 'current-checkout',
      hostId: 'runtime:old-destination',
      worktreeId: 'checkout',
      path: '/checkout'
    }
  }
  const pendingWorktreeCreations: Record<string, { request: WorktreeCreationRequest }> = {
    launch: { request }
  }
  mocks.get.mockReturnValue({
    pendingWorktreeCreations,
    getKnownWorktreeById: () =>
      makeWorktree({
        id: 'checkout',
        repoId: 'repo',
        path: '/checkout',
        hostId: 'runtime:old-destination'
      }),
    updateWorktreeMeta: mocks.mutate
  })
  const launch = launchCurrentCheckoutSession('launch', request)
  delete pendingWorktreeCreations.launch
  finish()
  await launch
  expect(mocks.mutate).not.toHaveBeenCalled()
  expect(mocks.launch).not.toHaveBeenCalled()
})
