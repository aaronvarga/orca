import { expect, it } from 'vitest'
import type { NativeChatMessage } from '../../native-chat-types'
import { createNativeChatClaudeTaskProjection } from './native-chat-claude-task-projection'
import { nativeChatDockedTaskList } from './native-chat-task-list-state'

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
        output: typeof output === 'string' ? output : JSON.stringify(output),
        callId: id,
        isError: failed
      }
    ]
  }
}
const create = operation(
  'create',
  'TaskCreate',
  { subject: 'Write components', activeForm: 'Writing components' },
  { task: { id: '1', subject: 'Write components', status: 'pending' } }
)

it('tracks task IDs across creates, updates, readbacks, and deletion', () => {
  const project = createNativeChatClaudeTaskProjection()
  const messages = [
    create,
    operation(
      'second',
      'TaskCreate',
      { subject: 'Publish' },
      'Task #2 created successfully: Publish'
    ),
    operation(
      'start',
      'TaskUpdate',
      { task_id: '1', status: 'in_progress', active_form: 'Writing components' },
      { success: true }
    ),
    operation('complete', 'TaskUpdate', { taskId: '2', status: 'completed' }, { success: true })
  ]
  expect(nativeChatDockedTaskList(project(messages))).toEqual({
    tasks: [
      { content: 'Write components', status: 'in_progress', activeForm: 'Writing components' },
      { content: 'Publish', status: 'completed' }
    ]
  })
  messages.push(
    operation('delete', 'TaskUpdate', { taskId: '1', status: 'deleted' }, { success: true })
  )
  expect(nativeChatDockedTaskList(project(messages))).toEqual({
    tasks: [{ content: 'Publish', status: 'completed' }]
  })
  messages.push(operation('list', 'TaskList', {}, { tasks: [] }))
  expect(nativeChatDockedTaskList(project(messages))).toBeNull()
})

it('does not apply failed operations, unrelated tools, or unknown task IDs', () => {
  const project = createNativeChatClaudeTaskProjection()
  const messages = [
    create,
    operation('error', 'TaskUpdate', { taskId: '1', status: 'completed' }, 'Denied', true),
    operation('unknown', 'TaskUpdate', { taskId: '99', status: 'completed' }, { success: true }),
    operation('mcp', 'mcp__x__TaskList', {}, { tasks: [] }),
    operation('invalid', 'TaskList', {}, { tasks: [{ id: '1' }] }),
    operation('rejected', 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: false })
  ]
  expect(nativeChatDockedTaskList(project(messages))).toEqual({
    tasks: [{ content: 'Write components', status: 'pending', activeForm: 'Writing components' }]
  })
})

it('restores the list from readback when the creation is outside loaded history', () => {
  const project = createNativeChatClaudeTaskProjection()
  const messages = [
    operation(
      'list',
      'TaskList',
      {},
      { tasks: [{ id: '8', subject: 'Upload assets', status: 'pending' }] }
    ),
    operation(
      'get',
      'TaskGet',
      { taskId: '8' },
      { task: { id: '8', subject: 'Upload assets', status: 'completed' } }
    )
  ]
  expect(nativeChatDockedTaskList(project(messages))).toEqual({
    tasks: [{ content: 'Upload assets', status: 'completed' }]
  })
})

it('replays prepended history and keeps unchanged projected snapshots stable', () => {
  const project = createNativeChatClaudeTaskProjection()
  const update = operation(
    'update',
    'TaskUpdate',
    { id: '1', status: 'completed' },
    { success: true }
  )
  expect(nativeChatDockedTaskList(project([update]))).toBeNull()
  const projected = project([create, update])
  expect(nativeChatDockedTaskList(projected)).toEqual({
    tasks: [{ content: 'Write components', status: 'completed', activeForm: 'Writing components' }]
  })
  expect(project([create, update])[1]).toBe(projected[1])
})
