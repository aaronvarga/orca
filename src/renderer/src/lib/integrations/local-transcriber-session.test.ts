// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { openLocalTranscriberSession } from './local-transcriber-session'

const mocks = vi.hoisted(() => ({
  state: {
    groupsByWorktree: { project: [{ id: 'left' }] },
    openFile: vi.fn(() => 'transcript'),
    findTabForEntityInGroup: vi.fn(() => ({ id: 'transcript-tab' })),
    dropUnifiedTab: vi.fn(() => true),
    activateTab: vi.fn()
  },
  launch: vi.fn(() => ({ surface: { kind: 'local-terminal', tabId: 'claude' } }))
}))
vi.mock('@/store/index', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))
vi.mock('@/runtime/native-chat/session-ownership/structured-agent-session-owner', () => ({
  resolveStructuredAgentSessionOwner: () => 'local'
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab', () => ({
  launchAgentInNewTabWithOutcome: mocks.launch
}))
vi.mock('@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents', () => ({
  settleAgentTabLaunch: async () => ({ kind: 'terminal' })
}))
vi.mock('sonner', () => ({ toast: { loading: () => 1, success: vi.fn(), error: vi.fn() } }))
afterEach(() => vi.unstubAllGlobals())

it('pairs the exact live transcript with Claude in its recording directory inside the chosen project', async () => {
  vi.stubGlobal('api', {
    platform: { get: () => ({ platform: 'darwin' }) },
    shell: {
      startTranscriberRecording: async () => ({
        filePath: '/Recordings/Client Call.md',
        directory: '/Recordings',
        reused: true,
        paused: false
      })
    }
  })
  await openLocalTranscriberSession('project', 'left')
  expect(mocks.launch).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
      sessionOptions: { model: 'sonnet' },
      worktreeId: 'project',
      groupId: 'left',
      initialCwd: '/Recordings',
      prompt: expect.stringContaining('/Recordings/Client Call.md')
    })
  )
  expect(mocks.state.openFile).toHaveBeenCalledWith(
    expect.objectContaining({
      filePath: '/Recordings/Client Call.md',
      worktreeId: 'project',
      readOnly: true,
      liveTail: true,
      runtimeEnvironmentId: null
    }),
    expect.objectContaining({
      placementWorkspaceId: 'project',
      executionHostId: 'local',
      targetGroupId: 'left'
    })
  )
  expect(mocks.state.dropUnifiedTab).toHaveBeenCalledWith('transcript-tab', {
    groupId: 'left',
    index: 0,
    splitDirection: 'right'
  })
})
