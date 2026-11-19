import { expect, it } from 'vitest'
import type { AgentSessionHistoryPage } from '../../agent-session-wire'
import {
  EMPTY_STRUCTURED_AGENT_SESSION,
  reduceStructuredAgentSession
} from './structured-agent-session-reducer'

function page(): AgentSessionHistoryPage {
  return {
    sessionId: 'one',
    epoch: 'epoch',
    direction: 'tail',
    items: [],
    removedItemIds: [],
    submissions: [],
    window: { oldest: null, newest: null, nextCursor: { epoch: 'epoch', sequence: 1 } },
    hasOlder: true,
    hasNewer: false
  }
}

it('restores off-page milestones on reconnect and keeps live state authoritative over stale history', () => {
  const opened = reduceStructuredAgentSession(EMPTY_STRUCTURED_AGENT_SESSION, {
    type: 'event',
    event: { type: 'snapshot', sessionId: 'one', fence: 1, page: page(), milestones: null }
  })
  const live = reduceStructuredAgentSession(opened, {
    type: 'event',
    event: {
      type: 'batch',
      sessionId: 'one',
      batch: {
        cursor: { epoch: 'epoch', sequence: 2 },
        items: [],
        removedItemIds: [],
        submissions: []
      },
      milestones: { tasks: [{ id: 'phase', content: 'Implement', status: 'in_progress' }] }
    }
  })
  const stale = reduceStructuredAgentSession(live, {
    type: 'history-page',
    page: { ...page(), milestones: null }
  })
  expect(stale.milestones).toEqual({
    tasks: [{ id: 'phase', content: 'Implement', status: 'in_progress' }]
  })
  const reconnected = reduceStructuredAgentSession(stale, {
    type: 'event',
    event: {
      type: 'snapshot',
      sessionId: 'one',
      fence: 1,
      page: page(),
      milestones: { tasks: [{ id: 'phase', content: 'Implement', status: 'completed' }] }
    }
  })
  expect(reconnected.milestones).toEqual({
    tasks: [{ id: 'phase', content: 'Implement', status: 'completed' }]
  })
  const cleared = reduceStructuredAgentSession(reconnected, {
    type: 'event',
    event: {
      type: 'batch',
      sessionId: 'one',
      batch: {
        cursor: { epoch: 'epoch', sequence: 2 },
        items: [],
        removedItemIds: [],
        submissions: []
      },
      milestones: null
    }
  })
  expect(
    reduceStructuredAgentSession(cleared, {
      type: 'history-page',
      page: {
        ...page(),
        milestones: { tasks: [{ id: 'phase', content: 'Stale phase', status: 'pending' }] }
      }
    }).milestones
  ).toBeNull()
  expect(
    reduceStructuredAgentSession(reconnected, {
      type: 'event',
      event: { type: 'snapshot', sessionId: 'one', fence: 1, page: page() }
    }).milestones
  ).toBeUndefined()
})
