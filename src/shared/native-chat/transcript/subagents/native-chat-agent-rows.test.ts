import { expect, it } from 'vitest'
import { nativeChatAgentRows } from './native-chat-agent-rows'
import type { AgentChildWorkView } from '../../../agent-status/child-work/agent-status-child-work-view'

const context = {
  parentEvidenceFresh: true,
  transportObservation: 'live' as const,
  parentObservedAt: 2000,
  hostClockOffsetMs: 0
}
const live: AgentChildWorkView = {
  id: 'host-child',
  providerId: 'child',
  kind: 'agent',
  name: 'Review',
  state: 'working',
  membership: 'live',
  firstObservedAt: 1000,
  observedAt: 2000,
  operation: { toolName: 'read', input: 'source.ts', basis: 'open', observedAt: 2000 },
  totalTokens: 1234,
  stoppable: true,
  invocation: { invocationId: 'run', generation: 1 }
}
it('joins current host activity to durable agent history without duplicate or false live rows', () => {
  const rows = nativeChatAgentRows(
    [
      {
        id: 'parent',
        label: 'Implementation',
        state: 'completed',
        startedAt: 500,
        settledAt: 1500
      },
      { id: 'child', label: 'Review', state: 'working', startedAt: 1000 },
      { id: 'lost', label: 'Lost connection', state: 'working', startedAt: 1200 }
    ],
    [live],
    context,
    new Map([['child', 'parent']])
  )
  expect(rows).toMatchObject([
    {
      id: 'parent',
      displayState: 'working',
      owned: [
        {
          id: 'host-child',
          displayState: 'working',
          totalTokens: 1234,
          detail: { kind: 'operation', toolName: 'read', input: 'source.ts' }
        }
      ]
    },
    { id: 'lost', displayState: 'unverifiable' }
  ])
  const offline = nativeChatAgentRows([], [live], {
    ...context,
    transportObservation: 'unverifiable'
  })
  expect(offline[0].displayState).toBe('unverifiable')
  const history = nativeChatAgentRows(
    [{ id: 'done', label: 'Verified', state: 'completed', startedAt: 500, settledAt: 1500 }],
    [],
    context
  )
  expect(history[0]).toMatchObject({ displayState: 'done', settled: true, settledAt: 1500 })
})
