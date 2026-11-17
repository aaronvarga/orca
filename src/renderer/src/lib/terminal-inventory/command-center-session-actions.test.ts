import { beforeEach, expect, it, vi } from 'vitest'
import { openSessionInProject } from './command-center-session-actions'
import { callHostRoute } from '@/runtime/rpc/calls/host-route-call'
import { readTerminalInventory } from './read-terminal-inventory'
import { revealTerminalPane } from '@/lib/workspace/activation/reveal-terminal-pane'
import type { CommandCenterSession } from './terminal-inventory-state'
import { isHostIdentityFenceCurrent } from '@/runtime/rpc/environment-revisions/host-identity-fence'

vi.mock('@/runtime/rpc/calls/host-route-call', () => ({ callHostRoute: vi.fn() }))
vi.mock('./read-terminal-inventory', () => ({ readTerminalInventory: vi.fn() }))
vi.mock('./use-terminal-inventory', () => ({ refreshTerminalInventory: vi.fn() }))
vi.mock('@/runtime/rpc/environment-revisions/host-identity-fence', () => ({
  captureHostIdentityFence: () => ({}),
  isHostIdentityFenceCurrent: vi.fn(() => true)
}))
vi.mock('@/lib/workspace/activation/reveal-terminal-pane', () => ({
  revealTerminalPane: vi.fn(() => true)
}))
vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ activeView: 'command-center', setActiveView: vi.fn() }) }
}))

const session: CommandCenterSession = {
  id: 'session',
  ownerId: 'local',
  route: { target: { kind: 'local' }, at: 'local' },
  previewPtyId: 'pty',
  available: true,
  terminal: {
    handle: 'term',
    ptyId: 'pty',
    incarnationId: 'original',
    worktreeId: 'repo::/repo',
    worktreePath: '/repo',
    branch: 'main',
    tabId: 'pty:pty',
    leafId: 'pty:pty',
    title: null,
    connected: true,
    writable: true,
    lastOutputAt: null,
    preview: '',
    executionHostId: 'local',
    verdict: 'live',
    orphaned: true,
    recordedPaneKey: 'tab:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  }
}
const census = {
  terminals: [session.terminal],
  totalCount: 1,
  truncated: false,
  hostScope: { hostIds: ['local' as const], omittedHostIds: [] },
  topologyRevisions: { 'repo::/repo': 3 }
}
beforeEach(() => {
  vi.mocked(callHostRoute).mockReset()
  vi.mocked(readTerminalInventory).mockReset()
  vi.mocked(revealTerminalPane).mockClear()
  vi.mocked(isHostIdentityFenceCurrent).mockReturnValue(true)
})

it('adopts only the captured orphan process against its fresh topology revision', async () => {
  vi.mocked(readTerminalInventory)
    .mockResolvedValueOnce(census)
    .mockResolvedValueOnce({
      ...census,
      terminals: [
        {
          ...session.terminal,
          orphaned: false,
          tabId: 'tab',
          leafId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        }
      ]
    })
  await openSessionInProject(session)
  expect(callHostRoute).toHaveBeenCalledWith(session.route, 'terminal.adoptOrphans', {
    worktree: 'id:repo::/repo',
    expectedTopologyRevision: 3,
    claims: [
      {
        terminal: 'term',
        ptyId: 'pty',
        incarnationId: 'original',
        tabId: 'tab',
        leafId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      }
    ]
  })
  expect(revealTerminalPane).toHaveBeenCalledWith({
    worktreeId: 'repo::/repo',
    tabId: 'tab',
    leafId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    executionHostId: 'local'
  })
})

it('keeps Command Center selected if the host rejects adoption of a replaced process', async () => {
  vi.mocked(readTerminalInventory).mockResolvedValue(census)
  vi.mocked(callHostRoute).mockRejectedValue(new Error('terminal_orphan_stale'))
  await expect(openSessionInProject(session)).rejects.toThrow('terminal_orphan_stale')
  expect(revealTerminalPane).not.toHaveBeenCalled()
})

it('refuses to mutate a host whose pairing changed after the observational census', async () => {
  vi.mocked(readTerminalInventory).mockImplementation(async () => {
    vi.mocked(isHostIdentityFenceCurrent).mockReturnValue(false)
    return census
  })
  await expect(openSessionInProject(session)).rejects.toThrow()
  expect(callHostRoute).not.toHaveBeenCalled()
  expect(revealTerminalPane).not.toHaveBeenCalled()
})
