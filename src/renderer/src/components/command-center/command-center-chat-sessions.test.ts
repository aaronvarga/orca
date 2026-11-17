import { expect, it } from 'vitest'
import { useAppStore } from '@/store'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import type { Tab } from '../../../../shared/workspace-layout/tab-groups/tab-types'
import { commandCenterChatSessions } from './command-center-chat-sessions'

it('lists open native chats with their owning project, and excludes terminal tabs and unknown owners', () => {
  const tab: Tab = {
    id: 'chat-tab',
    entityId: 'chat-session',
    worktreeId: 'workspace',
    groupId: 'group',
    executionHostId: 'local',
    contentType: 'agent-session',
    agentSessionAgent: 'codex',
    label: 'Codex Chat',
    customLabel: 'Review receipts',
    color: null,
    sortOrder: 0,
    createdAt: 1
  }
  const workspace = makeWorktree({
    id: 'workspace',
    repoId: 'project',
    path: '/project',
    hostId: 'local'
  })
  const state = {
    ...useAppStore.getState(),
    repos: [
      { id: 'project', path: '/project', displayName: 'LoadManager', badgeColor: '', addedAt: 1 }
    ],
    worktreesByRepo: { project: [workspace] },
    unifiedTabsByWorktree: {
      workspace: [
        tab,
        { ...tab, id: 'shell', contentType: 'terminal' as const },
        { ...tab, id: 'unowned', executionHostId: 'ssh:missing' as const }
      ]
    },
    getKnownWorktreeById: () => workspace
  }
  const sessions = commandCenterChatSessions(state)
  expect(sessions).toHaveLength(1)
  expect(sessions[0]).toMatchObject({
    kind: 'chat',
    ownerId: 'local',
    repoId: 'project',
    title: 'Review receipts',
    repo: { displayName: 'LoadManager' },
    chat: { sessionId: 'chat-session', target: { kind: 'local' }, agent: 'codex' }
  })
})
