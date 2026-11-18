// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { acceptedAgentStatuses } from '@/store/slices/agent-status/status-ownership/accepted-agent-statuses'
import { makeTab } from '@/store/terminals/testing/terminal-tab.test-fixture'
import type { AgentStatusEntry } from '../../../../shared/agent-status/contracts/agent-status-types'
import type { CommandCenterSession } from '@/lib/terminal-inventory/terminal-inventory-state'
import { commandCenterChatSessions } from '../command-center/command-center-chat-sessions'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { structuredAgentSessionPaneKey } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import { getProjectRailStatus } from './project-rail-status'

const original = useAppStore.getState()
const leaf = '11111111-1111-4111-8111-111111111111'
const now = 1_700_000_000_000
beforeEach(() => vi.useFakeTimers({ now }))
afterEach(() => {
  useAppStore.setState(original, true)
  vi.useRealTimers()
})

function session(id: string): CommandCenterSession {
  return {
    id,
    ownerId: 'local',
    route: { target: { kind: 'local' }, at: 'local' },
    available: true,
    previewPtyId: `pty-${id}`,
    terminal: {
      handle: id,
      ptyId: `pty-${id}`,
      worktreeId: 'workspace',
      worktreePath: '/workspace',
      tabId: id,
      leafId: leaf,
      branch: 'main',
      title: null,
      connected: true,
      writable: true,
      lastOutputAt: null,
      preview: ''
    }
  }
}

function seed(entries: [string, AgentStatusEntry['state']][]) {
  useAppStore.setState({
    tabsByWorktree: {
      workspace: entries.map(([id]) => makeTab({ id, worktreeId: 'workspace', ptyId: `pty-${id}` }))
    },
    unifiedTabsByWorktree: {},
    terminalLayoutsByTabId: Object.fromEntries(
      entries.map(([id]) => [
        id,
        {
          root: { type: 'leaf', leafId: leaf },
          activeLeafId: leaf,
          expandedLeafId: null,
          ptyIdsByLeafId: { [leaf]: `pty-${id}` }
        }
      ])
    ),
    ptyIdsByTabId: Object.fromEntries(entries.map(([id]) => [id, [`pty-${id}`]])),
    unreadAgentCompletionPanes: { [`done:${leaf}`]: true },
    agentStatusByPaneKey: acceptedAgentStatuses(
      entries.map(([id, state]) => [
        `${id}:${leaf}`,
        {
          paneKey: `${id}:${leaf}`,
          worktreeId: 'workspace',
          state,
          agentType: 'claude',
          prompt: '',
          updatedAt: now,
          stateStartedAt: now,
          stateHistory: [],
          programStatus: { state: 'working', progress: 42, observedAt: now }
        }
      ])
    )
  })
  return useAppStore.getState()
}

it('keeps unread completions while prioritizing input over work and reporting exact single-agent progress', () => {
  const state = seed([
    ['working', 'working'],
    ['waiting', 'waiting'],
    ['done', 'done']
  ])
  expect(getProjectRailStatus([session('working')], state)).toEqual({
    count: 1,
    unread: false,
    state: 'working',
    progress: 42
  })
  expect(
    getProjectRailStatus([session('working'), session('waiting'), session('done')], state)
  ).toEqual({
    count: 3,
    unread: true,
    state: 'waiting',
    progress: undefined
  })
})

it('does not borrow unread or progress from a replaced pane, or count an unavailable host', () => {
  const state = seed([
    ['done', 'done'],
    ['working', 'working']
  ])
  expect(
    getProjectRailStatus(
      [
        { ...session('done'), previewPtyId: 'replacement' },
        { ...session('working'), available: false }
      ],
      state
    )
  ).toEqual({ count: 1, unread: false })
})

it('includes native chat status in folder workspaces on a remote host', () => {
  seed([])
  const key = structuredAgentSessionPaneKey('chat-tab', 'chat-session')
  useAppStore.setState({
    repos: [
      {
        id: 'project',
        displayName: 'Notes',
        path: '/notes',
        kind: 'folder',
        badgeColor: '',
        addedAt: 1,
        executionHostId: 'runtime:server'
      }
    ],
    worktreesByRepo: {
      project: [
        makeWorktree({
          id: 'workspace',
          repoId: 'project',
          path: '/notes',
          hostId: 'runtime:server'
        })
      ]
    },
    unifiedTabsByWorktree: {
      workspace: [
        {
          id: 'chat-tab',
          entityId: 'chat-session',
          worktreeId: 'workspace',
          groupId: 'group',
          executionHostId: 'runtime:server',
          contentType: 'agent-session',
          agentSessionAgent: 'codex',
          label: 'Chat',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        }
      ]
    },
    agentStatusByPaneKey: acceptedAgentStatuses([
      [
        key,
        {
          paneKey: key,
          worktreeId: 'workspace',
          state: 'waiting',
          agentType: 'codex',
          prompt: '',
          updatedAt: now,
          stateStartedAt: now,
          stateHistory: []
        }
      ]
    ])
  })
  const state = useAppStore.getState()
  const chats = commandCenterChatSessions(state)
  expect(chats.map((chat) => chat.ownerId)).toEqual(['runtime:server'])
  expect(getProjectRailStatus(chats, state)).toEqual({
    count: 1,
    unread: false,
    state: 'waiting',
    progress: undefined
  })
})
