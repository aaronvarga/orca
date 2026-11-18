import { expect, it } from 'vitest'
import {
  readClaudeMessageEnvelope,
  claudeToolResults,
  claudeToolBody
} from './claude-structured-item-translation'

it.each(['tool_use_result', 'toolUseResult'])(
  'preserves assigned task IDs from %s through journal translation',
  (field) => {
    const envelope = readClaudeMessageEnvelope({
      type: 'user',
      uuid: 'result',
      session_id: 'session',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'create', content: 'Task created' }]
      },
      [field]: { task: { id: '42', subject: 'Upload assets', status: 'pending' } }
    })!
    const result = claudeToolResults(envelope)[0]
    const body = claudeToolBody({
      tool: { id: 'create', name: 'TaskCreate', input: { subject: 'Upload assets' } },
      result
    })
    expect(body).toMatchObject({
      kind: 'tool-call',
      callId: 'create',
      state: 'completed',
      output: { head: '{"task":{"id":"42","subject":"Upload assets","status":"pending"}}' }
    })
    expect(
      claudeToolBody({
        tool: { id: 'create', name: 'TaskCreate', input: {} },
        result: { ...result, failed: true, output: 'Permission denied' }
      })
    ).toMatchObject({ state: 'failed', output: { head: 'Permission denied' } })
    expect(claudeToolBody({ tool: { id: 'read', name: 'Read', input: {} }, result })).toMatchObject(
      { output: { head: 'Task created' } }
    )
  }
)
