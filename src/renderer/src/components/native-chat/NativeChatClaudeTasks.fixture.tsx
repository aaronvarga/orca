import { defineFixture } from '../../component-fixtures/component-fixture'
import { NativeChatDockedTaskList } from './tools/tasks/NativeChatDockedTaskList'
import { createNativeChatClaudeTaskProjection } from '../../../../shared/native-chat/input/task-lists/native-chat-claude-task-projection'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'

const messages: NativeChatMessage[] = [
  {
    id: 'list',
    role: 'assistant',
    source: 'transcript',
    timestamp: 1,
    blocks: [
      { type: 'tool-call', name: 'TaskList', input: {}, callId: 'list', state: 'completed' },
      {
        type: 'tool-result',
        callId: 'list',
        output: JSON.stringify({
          tasks: [
            {
              id: '1',
              subject: 'Read type references and inventory frontend styles',
              status: 'completed'
            },
            {
              id: '2',
              subject: 'Write tokens, README, components',
              activeForm: 'Writing tokens, README, components',
              status: 'in_progress'
            },
            { id: '3', subject: 'Upload logo assets', status: 'pending' },
            { id: '4', subject: 'Publish system and cover', status: 'pending' }
          ]
        })
      }
    ]
  }
]
const projected = createNativeChatClaudeTaskProjection()(messages)
export const progress = defineFixture({
  width: 720,
  render: () => (
    <div className="native-chat-appearance py-6">
      <NativeChatDockedTaskList messages={projected} />
    </div>
  )
})
export const narrow = defineFixture({
  width: 360,
  render: () => (
    <div className="native-chat-appearance py-6">
      <NativeChatDockedTaskList messages={projected} />
    </div>
  )
})
