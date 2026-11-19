import { expect, it } from 'vitest'
import type { NativeChatMessage } from '../../native-chat-types'
import { nativeChatMilestones, nativeChatMilestonesMarkdown } from './native-chat-milestones'

function operation(
  id: string,
  name: string,
  input: unknown,
  output: unknown,
  failed = false
): NativeChatMessage {
  return {
    id,
    role: 'assistant',
    source: 'transcript',
    timestamp: 1,
    blocks: [
      { type: 'tool-call', name, input, callId: id, state: failed ? 'failed' : 'completed' },
      {
        type: 'tool-result',
        callId: id,
        output: typeof output === 'string' ? output : JSON.stringify(output),
        isError: failed
      }
    ]
  }
}
const marked = (subject: string) => ({ subject, description: '<!-- orca-session-milestone -->' })

it('keeps marked Claude goals separate, preserving IDs through updates, failures, reads and removal', () => {
  const history = [
    operation(
      'a',
      'TaskCreate',
      marked('Implement goals'),
      'Task #1 created successfully: Implement goals'
    ),
    operation(
      'b',
      'TaskCreate',
      { subject: 'Internal search' },
      'Task #2 created successfully: Internal search'
    ),
    operation(
      'c',
      'TaskCreate',
      marked('Verify outcomes'),
      'Task #3 created successfully: Verify outcomes'
    ),
    operation(
      'd',
      'TaskUpdate',
      { taskId: '1', subject: 'Implement milestones', status: 'in_progress' },
      'Updated'
    ),
    operation('e', 'TaskUpdate', { taskId: '3', status: 'completed' }, 'Denied', true),
    operation('f', 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: false }),
    operation(
      'g',
      'TaskList',
      {},
      {
        tasks: [
          { id: '1', subject: 'Implement milestones', status: 'in_progress' },
          { id: '2', subject: 'Internal search', status: 'pending' },
          { id: '3', subject: 'Verify outcomes', status: 'pending' }
        ]
      }
    )
  ]
  expect(nativeChatMilestones(history)).toEqual({
    tasks: [
      { id: '1', content: 'Implement milestones', status: 'in_progress' },
      { id: '3', content: 'Verify outcomes', status: 'pending' }
    ]
  })
  expect(
    nativeChatMilestones([
      ...history,
      operation('h', 'TaskUpdate', { taskId: '1', status: 'deleted' }, 'Deleted')
    ])
  ).toEqual({ tasks: [{ id: '3', content: 'Verify outcomes', status: 'pending' }] })
  expect(
    nativeChatMilestones([
      { ...history[0], agentId: 'child' },
      operation('root-update', 'TaskUpdate', { taskId: '1', status: 'completed' }, 'Updated')
    ])
  ).toBeNull()
})

it('accepts only marked Codex snapshots and retains empty plans and failed-update state', () => {
  const plan = operation(
    'a',
    'update_plan',
    {
      explanation: 'orca-session-milestones',
      plan: [
        { step: 'Implement', status: 'in_progress' },
        { step: 'Verify', status: 'pending' }
      ]
    },
    'Updated'
  )
  const internal = operation(
    'b',
    'update_plan',
    { plan: [{ step: 'Search', status: 'completed' }] },
    'Updated'
  )
  expect(nativeChatMilestones([plan, internal])).toEqual({
    tasks: [
      { id: 'step-1', content: 'Implement', status: 'in_progress' },
      { id: 'step-2', content: 'Verify', status: 'pending' }
    ]
  })
  expect(
    nativeChatMilestones([
      plan,
      operation(
        'c',
        'update_plan',
        { explanation: 'orca-session-milestones', plan: [] },
        'Failed',
        true
      )
    ])
  ).toEqual(nativeChatMilestones([plan]))
  expect(
    nativeChatMilestones([
      plan,
      operation('d', 'update_plan', { explanation: 'orca-session-milestones', plan: [] }, 'Updated')
    ])
  ).toEqual({ tasks: [] })
})

it('keeps Codex identities across reordering, renaming and removing a phase', () => {
  const history = [
    operation(
      'a',
      'update_plan',
      {
        explanation: 'orca-session-milestones',
        plan: [
          { step: 'Implement', status: 'pending' },
          { step: 'Verify', status: 'pending' }
        ]
      },
      'Updated'
    ),
    operation(
      'b',
      'update_plan',
      {
        explanation: 'orca-session-milestones',
        plan: [
          { step: 'Verify', status: 'in_progress' },
          { step: 'Implement milestones', status: 'completed' }
        ]
      },
      'Updated'
    )
  ]
  expect(nativeChatMilestones(history)).toEqual({
    tasks: [
      { id: 'step-2', content: 'Verify', status: 'in_progress' },
      { id: 'step-1', content: 'Implement milestones', status: 'completed' }
    ]
  })
  expect(
    nativeChatMilestones([
      ...history,
      operation(
        'c',
        'update_plan',
        { explanation: 'orca-session-milestones', plan: [{ step: 'Verify', status: 'completed' }] },
        'Updated'
      )
    ])
  ).toEqual({ tasks: [{ id: 'step-2', content: 'Verify', status: 'completed' }] })
})

it('starts a new batch after completion even when Claude lists old completed tasks again', () => {
  const history: NativeChatMessage[] = []
  for (let id = 1; id <= 6; id++) {
    history.push(
      operation(
        `create-${id}`,
        'TaskCreate',
        marked(`Old goal ${id}`),
        `Task #${id} created successfully: Old goal ${id}`
      )
    )
  }
  for (let id = 1; id <= 6; id++) {
    history.push(
      operation(`done-${id}`, 'TaskUpdate', { taskId: String(id), status: 'completed' }, 'Updated')
    )
  }
  history.push(
    operation('new', 'TaskCreate', marked('New scope'), 'Task #7 created successfully: New scope')
  )
  history.push(
    operation(
      'read',
      'TaskList',
      {},
      {
        tasks: [
          ...Array.from({ length: 6 }, (_, index) => ({
            id: String(index + 1),
            subject: `Old goal ${index + 1}`,
            status: 'completed'
          })),
          { id: '7', subject: 'New scope', status: 'pending' }
        ]
      }
    )
  )
  expect(nativeChatMilestones(history)).toEqual({
    tasks: [{ id: '7', content: 'New scope', status: 'pending' }]
  })
})

it('reopens a related milestone while retaining completed siblings in the same batch', () => {
  expect(
    nativeChatMilestones([
      operation('a', 'TaskCreate', marked('Implement'), 'Task #1 created successfully: Implement'),
      operation('b', 'TaskCreate', marked('Verify'), 'Task #2 created successfully: Verify'),
      operation('c', 'TaskUpdate', { taskId: '1', status: 'completed' }, 'Updated'),
      operation('d', 'TaskUpdate', { taskId: '2', status: 'completed' }, 'Updated'),
      operation('e', 'TaskUpdate', { taskId: '2', status: 'in_progress' }, 'Updated')
    ])
  ).toEqual({
    tasks: [
      { id: '1', content: 'Implement', status: 'completed' },
      { id: '2', content: 'Verify', status: 'in_progress' }
    ]
  })
})

it('extracts agent ETAs from native plans, refreshes them without changing identity, and removes completed ETAs', () => {
  const history = [
    operation(
      'a',
      'update_plan',
      {
        explanation: 'orca-session-milestones',
        plan: [
          { step: 'Implement [ETA: ~2–4 min]', status: 'in_progress' },
          { step: 'Verify [ETA: ~30–60 s]', status: 'pending' }
        ]
      },
      'Updated'
    )
  ]
  const first = nativeChatMilestones(history)!
  expect(first.tasks).toEqual([
    { id: 'step-1', content: 'Implement', status: 'in_progress', eta: '~2–4 min' },
    { id: 'step-2', content: 'Verify', status: 'pending', eta: '~30–60 s' }
  ])
  expect(nativeChatMilestonesMarkdown(first)).toBe(
    '# Session milestones\n\n- [ ] Implement (current) — ETA ~2–4 min\n- [ ] Verify — ETA ~30–60 s\n'
  )
  expect(
    nativeChatMilestones([
      ...history,
      operation(
        'b',
        'update_plan',
        {
          explanation: 'orca-session-milestones',
          plan: [
            { step: 'Implement [ETA: ~2–4 min]', status: 'completed' },
            { step: 'Verify [ETA: ~20 s]', status: 'in_progress' }
          ]
        },
        'Updated'
      )
    ])?.tasks
  ).toEqual([
    { id: 'step-1', content: 'Implement', status: 'completed' },
    { id: 'step-2', content: 'Verify', status: 'in_progress', eta: '~20 s' }
  ])
  expect(
    nativeChatMilestones([
      operation(
        'claude',
        'TaskCreate',
        marked('Check host [ETA: ~1 min]'),
        'Task #1 created successfully: Check host [ETA: ~1 min]'
      )
    ])?.tasks
  ).toEqual([{ id: '1', content: 'Check host', status: 'pending', eta: '~1 min' }])
})

it('keeps technical notes separate from short native milestone titles', () => {
  expect(
    nativeChatMilestones([
      operation(
        'claude-details',
        'TaskCreate',
        {
          ...marked('Retry failed deliveries'),
          description:
            '<!-- orca-session-milestone --> Check retry handling for issue #42 (https://example.com/issues/42).'
        },
        'Task #1 created successfully: Retry failed deliveries'
      )
    ])?.tasks
  ).toEqual([
    {
      id: '1',
      content: 'Retry failed deliveries',
      status: 'pending',
      details: 'Check retry handling for issue #42 (https://example.com/issues/42).'
    }
  ])
  expect(
    nativeChatMilestones([
      operation(
        'codex-details',
        'update_plan',
        {
          explanation: 'orca-session-milestones',
          plan: [
            {
              step: 'Retry failed deliveries [ETA: ~2 min] [Details: Check retry handling for issue #42 (https://example.com/issues/42).]',
              status: 'in_progress'
            }
          ]
        },
        'Updated'
      )
    ])?.tasks
  ).toEqual([
    {
      id: 'step-1',
      content: 'Retry failed deliveries',
      status: 'in_progress',
      eta: '~2 min',
      details: 'Check retry handling for issue #42 (https://example.com/issues/42).'
    }
  ])
})
