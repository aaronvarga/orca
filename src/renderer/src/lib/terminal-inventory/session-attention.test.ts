import { expect, it } from 'vitest'
import { hasInventorySessionAttention } from './session-attention'
import type { CommandCenterSession } from './terminal-inventory-state'

it('shows unread attention only for the admitted process bound to the pane', () => {
  const session: CommandCenterSession = {
    id: 'session',
    ownerId: 'local',
    route: { target: { kind: 'local' }, at: 'local' },
    previewPtyId: 'pty-current',
    available: true,
    terminal: {
      handle: 'handle',
      ptyId: 'pty-current',
      incarnationId: 'first',
      worktreeId: 'repo::/repo',
      worktreePath: '/repo',
      branch: 'main',
      tabId: 'tab',
      leafId: '11111111-1111-4111-8111-111111111111',
      title: null,
      connected: true,
      writable: true,
      lastOutputAt: null,
      preview: ''
    }
  }
  const state = {
    terminalLayoutsByTabId: {
      tab: {
        root: null,
        activeLeafId: null,
        expandedLeafId: null,
        ptyIdsByLeafId: { '11111111-1111-4111-8111-111111111111': 'pty-current' }
      }
    },
    unreadAgentCompletionPanes: { 'tab:11111111-1111-4111-8111-111111111111': true as const }
  }
  expect(hasInventorySessionAttention(session, state)).toBe(true)
  expect(hasInventorySessionAttention({ ...session, previewPtyId: 'pty-replacement' }, state)).toBe(
    false
  )
  expect(hasInventorySessionAttention({ ...session, available: false }, state)).toBe(false)
})
