import { beforeEach, expect, it, vi } from 'vitest'
import type { SkillDiscoveryResult } from '../../../../../shared/skills/discovery/skills'
import type { AgentSessionContinuationRequest } from './agent-session-continuation'
import { prepareAgentSkillHandoff } from './prepare-agent-skill-handoff'

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  read: vi.fn(),
  send: vi.fn(),
  context: vi.fn(),
  root: vi.fn(),
  revision: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({}) } }))
vi.mock('@/runtime/skills/configuration/runtime-skills-client', () => ({
  discoverSkillsForRuntimeTarget: mocks.discover
}))
vi.mock('@/runtime/files/reads/runtime-file-read-client', () => ({
  readRuntimeFileContent: mocks.read
}))
vi.mock('@/components/native-chat/composer/pickers/native-chat-skill-discovery-context', () => ({
  resolveNativeChatSkillDiscoveryContext: mocks.context
}))
vi.mock('@/lib/workspace/paths/workspace-directory', () => ({
  resolveWorkspaceDirectory: mocks.root
}))
vi.mock('@/runtime/rpc/environment-revisions/runtime-environment-revision', () => ({
  captureRuntimeEnvironmentRequestRevision: mocks.revision
}))
vi.mock(
  '@/components/native-chat/session/structured/delivery/structured-agent-session-message-sender',
  () => ({ sendStructuredAgentSessionMessage: mocks.send })
)
vi.mock('../messaging/terminal/active-agent-note-send', () => ({
  sendNotesToActiveAgentSession: async () => ({ status: 'sent' })
}))
vi.mock('../../../../../shared/identifiers/non-secure-context-uuid', () => ({
  createNonSecureContextUuid: () => 'handoff-a'
}))

const discovery: SkillDiscoveryResult = {
  scannedAt: 1,
  sources: [
    {
      id: 'shared',
      path: '/skills',
      label: 'Shared',
      sourceKind: 'home',
      providers: ['agent-skills'],
      owner: null,
      exists: true
    }
  ],
  skills: ['handoff', 'handoff-resume'].map((name) => ({
    id: name,
    name,
    description: null,
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Shared',
    rootPath: '/skills',
    directoryPath: `/skills/${name}`,
    skillFilePath: `/skills/${name}/SKILL.md`,
    installed: true,
    updatedAt: 1
  }))
}
const completed =
  '# Session Handoff\n\n- Handoff ID: handoff-a\n\n## Suggested Next Steps\nVerify the implementation.\n\n<!-- handoff-complete: handoff-a -->\n'
const request = (): AgentSessionContinuationRequest => ({
  source: { sourceAgent: 'claude', capturedText: '' },
  worktreeId: 'workspace',
  workspacePath: '/workspace',
  launchSource: 'native_chat',
  handoffSource: { worktreeId: 'workspace', tabId: 'source-tab', sessionId: 'source-chat' }
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockReturnValue({
    key: 'source-host',
    cwd: '/workspace/subfolder',
    executionHostKind: 'runtime',
    runtimeTarget: { kind: 'environment', environmentId: 'server' },
    discoveryTarget: { cwd: '/workspace/subfolder', worktreeId: 'workspace' }
  })
  mocks.root.mockReturnValue('/workspace')
  mocks.revision.mockReturnValue(7)
  mocks.discover.mockResolvedValue(discovery)
  mocks.send.mockReturnValue({ outcome: Promise.resolve('recorded') })
  mocks.read.mockImplementation(async (address) => ({
    content: address.relativePath.endsWith('.ready.json')
      ? '{"version":1,"handoffId":"handoff-a","file":"handoff-a.md","complete":true}'
      : completed,
    isBinary: false
  }))
})

it('returns the exact completed briefing on its source host, independent of the latest pointer', async () => {
  mocks.read.mockImplementation(async (address) => {
    const receipt = address.relativePath === '.orca/handoffs/handoff-a.ready.json'
    expect(address).toEqual({
      target: { kind: 'environment', environmentId: 'server' },
      worktreeId: 'workspace',
      filePath: receipt
        ? '/workspace/.orca/handoffs/handoff-a.ready.json'
        : '/workspace/.orca/handoffs/handoff-a.md',
      relativePath: receipt ? '.orca/handoffs/handoff-a.ready.json' : '.orca/handoffs/handoff-a.md',
      expectedEnvironmentPairingRevision: 7
    })
    return {
      content: receipt
        ? '{"version":1,"handoffId":"handoff-a","file":"handoff-a.md","complete":true}'
        : completed,
      isBinary: false
    }
  })
  const result = await prepareAgentSkillHandoff(request(), 'codex')
  expect(result.filePath).toBe('/workspace/.orca/handoffs/handoff-a.md')
})

it('does not accept an incomplete or differently identified briefing when preparation is cancelled', async () => {
  const abort = new AbortController()
  mocks.read.mockImplementation(async () => {
    abort.abort()
    return { content: '# Session Handoff\n- Handoff ID: other-session\n', isBinary: false }
  })
  await expect(prepareAgentSkillHandoff(request(), 'codex', abort.signal)).rejects.toMatchObject({
    name: 'AbortError'
  })
})

it('reuses an already requested handoff after cancellation instead of sending another agent turn', async () => {
  const source = request()
  const abort = new AbortController()
  mocks.read.mockImplementationOnce(async () => {
    abort.abort()
    return { content: '', isBinary: false }
  })
  await expect(prepareAgentSkillHandoff(source, 'codex', abort.signal)).rejects.toMatchObject({
    name: 'AbortError'
  })
  mocks.send.mockImplementation(() => {
    throw new Error('A repeated source turn would duplicate the handoff')
  })
  const result = await prepareAgentSkillHandoff(source, 'codex')
  expect(result.filePath).toBe('/workspace/.orca/handoffs/handoff-a.md')
})

it('refuses a host that was re-paired while skills were being discovered', async () => {
  mocks.discover.mockImplementation(async () => {
    mocks.revision.mockReturnValue(8)
    return discovery
  })
  await expect(prepareAgentSkillHandoff(request(), 'codex')).rejects.toBeInstanceOf(Error)
})

it('rejects an unconfirmed source send instead of treating delivery as completion', async () => {
  mocks.send.mockReturnValue({ outcome: Promise.resolve('unconfirmed') })
  await expect(prepareAgentSkillHandoff(request(), 'codex')).rejects.toBeInstanceOf(Error)
})

it('uses WSL paths for the agent and Windows host paths when verifying the published files', async () => {
  mocks.root.mockReturnValue('\\\\wsl.localhost\\Ubuntu\\home\\aaron\\project')
  mocks.context.mockReturnValue({
    key: 'wsl-source',
    cwd: '/home/aaron/project',
    executionHostKind: 'local',
    runtimeTarget: { kind: 'local' },
    discoveryTarget: { runtime: 'wsl', wslDistro: 'Ubuntu' }
  })
  mocks.read.mockImplementation(async (address) => {
    const receipt = address.relativePath === '.orca/handoffs/handoff-a.ready.json'
    expect(address.filePath).toBe(
      receipt
        ? '\\\\wsl.localhost\\Ubuntu\\home\\aaron\\project\\.orca\\handoffs\\handoff-a.ready.json'
        : '\\\\wsl.localhost\\Ubuntu\\home\\aaron\\project\\.orca\\handoffs\\handoff-a.md'
    )
    return {
      content: receipt
        ? '{"version":1,"handoffId":"handoff-a","file":"handoff-a.md","complete":true}'
        : completed,
      isBinary: false
    }
  })
  const result = await prepareAgentSkillHandoff(request(), 'codex')
  expect(result.filePath).toBe('/home/aaron/project/.orca/handoffs/handoff-a.md')
})
