import { defineFixture } from '../../component-fixtures/component-fixture'
import { NativeChatMessageList } from './NativeChatMessageList'
import { NativeChatComposer } from './composer/NativeChatComposer'
import { NativeChatQuestionCard } from './prompts/NativeChatQuestionCard'
import { nativeChatAppearanceStyle } from './appearance/native-chat-appearance-style'
import type { NativeChatLiveSession } from './session/terminal/read/native-chat-live-session-contract'
import { NativeChatReasoningRow } from './messages/reasoning/NativeChatReasoningRow'
import { NativeChatTurnActivityLine } from './messages/reasoning/NativeChatTurnActivityLine'
import { NativeChatToolLine } from './tools/lines/NativeChatToolLine'
import { NativeChatTaskList } from './tools/tasks/NativeChatTaskList'
import { NativeChatCodeBlock } from './markdown/code/NativeChatCodeBlock'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const session: NativeChatLiveSession = {
  agent: 'claude',
  sessionId: 'beautiful-ui',
  status: 'ready',
  readPhase: 'ready',
  hasMore: false,
  loadingEarlier: false,
  olderHistoryGeneration: 0,
  loadEarlier: async () => 'applied',
  messages: [
    {
      id: 'request',
      role: 'user',
      source: 'transcript',
      timestamp: 1_800_000_000_000,
      blocks: [{ type: 'text', text: 'Review the workspace and make the greeting clearer.' }]
    },
    {
      id: 'reasoning',
      role: 'reasoning',
      source: 'transcript',
      timestamp: 1_800_000_001_000,
      completedAt: 1_800_000_004_000,
      blocks: [
        { type: 'text', text: 'I will check the current greeting and keep its public interface.' }
      ]
    },
    {
      id: 'tools',
      role: 'assistant',
      source: 'transcript',
      timestamp: 1_800_000_005_000,
      blocks: [
        {
          type: 'tool-call',
          name: 'Read',
          state: 'completed',
          input: { file_path: '/projects/orca/src/greeting.ts' }
        },
        { type: 'tool-result', output: 'export const greeting = "Hi"' },
        {
          type: 'tool-call',
          name: 'Edit',
          state: 'completed',
          input: {
            file_path: '/projects/orca/src/greeting.ts',
            old_string: '"Hi"',
            new_string: '"Welcome back"'
          }
        },
        { type: 'tool-result', output: 'Updated greeting.ts' }
      ]
    },
    {
      id: 'answer',
      role: 'assistant',
      source: 'transcript',
      timestamp: 1_800_000_008_000,
      blocks: [
        {
          type: 'text',
          text: 'The greeting is clearer, and its export stays the same.\n\n```typescript\nexport const greeting = "Welcome back"\n```\n\n- Existing callers keep working.\n- No configuration changes are needed.'
        }
      ]
    }
  ]
}

function Conversation({
  question = false,
  working = false,
  fontSize = 13,
  height = 820
}: {
  question?: boolean
  working?: boolean
  fontSize?: number
  height?: number
}) {
  const [startedAt] = useState(() => Date.now() - 19_000)
  return (
    <div
      className="native-chat-appearance flex min-w-0 flex-col bg-chat-canvas"
      style={{ ...nativeChatAppearanceStyle({ nativeChatAppearance: { fontSize } }), height }}
    >
      <NativeChatMessageList
        session={session}
        isWorking={working}
        expandSignal={false}
        workingStartedAt={working ? startedAt : null}
        turnActivity={working ? { kind: 'description', text: 'Running a command' } : undefined}
      />
      {question ? (
        <NativeChatQuestionCard
          prompt={{
            questions: [
              {
                question: 'Which greeting should we use?',
                multiSelect: false,
                options: [
                  {
                    label: 'Welcome back',
                    description: 'A familiar greeting for returning users.'
                  },
                  { label: 'Hello there', description: 'A neutral greeting for everyone.' }
                ]
              }
            ]
          }}
          onAnswer={() => {}}
          onCancel={() => {}}
        />
      ) : (
        <NativeChatComposer
          terminalTabId="beautiful-ui"
          paneKey="beautiful-ui"
          targetPtyId={null}
          agent="claude"
          workspacePending
        />
      )}
    </div>
  )
}

export const desktop = defineFixture({ width: 1280, render: () => <Conversation /> })
export const splitPane = defineFixture({ width: 768, render: () => <Conversation /> })
export const narrow = defineFixture({ width: 320, render: () => <Conversation /> })
export const mobile = defineFixture({ width: 390, render: () => <Conversation height={780} /> })
export const largeText = defineFixture({ width: 768, render: () => <Conversation fontSize={20} /> })
export const question = defineFixture({ width: 768, render: () => <Conversation question /> })

export const activity = defineFixture({
  width: 480,
  render: () => (
    <div
      className="native-chat-appearance space-y-4 bg-chat-canvas p-4"
      style={nativeChatAppearanceStyle({})}
    >
      <NativeChatTurnActivityLine
        line={{ thinking: true, stopping: false, activityText: null, reasoning: null }}
      />
      <NativeChatReasoningRow
        message={session.messages[1]!}
        markdown="I will check the current greeting and keep its public interface."
      />
      <NativeChatToolLine
        block={{
          type: 'tool-call',
          name: 'Read',
          state: 'completed',
          input: { file_path: '/projects/orca/src/greeting.ts' }
        }}
        result={{ type: 'tool-result', output: 'export const greeting = "Welcome back"' }}
      />
      <NativeChatToolLine
        block={{
          type: 'tool-call',
          name: 'Bash',
          state: 'failed',
          input: { command: 'pnpm test' }
        }}
        result={{ type: 'tool-result', output: 'The runtime is unavailable.', isError: true }}
      />
      <NativeChatTaskList
        list={{
          tasks: [
            { content: 'Read the current greeting', status: 'completed' },
            { content: 'Update the greeting', status: 'in_progress' },
            { content: 'Review the result', status: 'pending' }
          ]
        }}
      />
    </div>
  ),
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('button.group\\/reasoning')?.click()
    frame.querySelector<HTMLButtonElement>('.group\\/tool-line')?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
})

export const longCode = defineFixture({
  width: 320,
  render: () => (
    <div
      className="native-chat-appearance bg-chat-canvas p-4"
      style={nativeChatAppearanceStyle({})}
    >
      <NativeChatCodeBlock language="typescript">
        <code>{'export const greeting = "Welcome back to a very long workspace name"\n'}</code>
      </NativeChatCodeBlock>
      <NativeChatCodeBlock>
        <code>unlabelled code keeps its copy and wrap controls</code>
      </NativeChatCodeBlock>
    </div>
  )
})

function LongConversation() {
  const [messages, setMessages] = useState<NativeChatLiveSession['messages']>(() =>
    Array.from({ length: 120 }, (_, index) => ({
      id: `history-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      source: 'transcript',
      timestamp: 1_800_000_000_000 + index * 60_000,
      blocks: [
        {
          type: 'text',
          text: `Workspace review ${index + 1}.\n\nKeep the existing interface and verify the changed behavior.`
        }
      ]
    }))
  )
  return (
    <div
      className="native-chat-appearance flex h-[820px] flex-col bg-chat-canvas"
      style={nativeChatAppearanceStyle({})}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setMessages((current) => [
            ...current,
            {
              id: `history-${current.length}`,
              role: 'assistant',
              source: 'transcript',
              timestamp: 1_800_000_000_000 + current.length * 60_000,
              blocks: [{ type: 'text', text: 'The next reply has arrived.' }]
            }
          ])
        }
      >
        Append reply
      </Button>
      <NativeChatMessageList
        session={{ ...session, messages }}
        isWorking={false}
        expandSignal={false}
      />
    </div>
  )
}

export const longSession = defineFixture({ width: 768, render: () => <LongConversation /> })

export const working = defineFixture({
  width: 768,
  render: () => <Conversation working />,
  interact: (frame) => {
    if (frame.querySelector('[data-native-chat-turn-status="active"]')) {
      throw new Error('The live turn must not also render a header status')
    }
    const activity = frame.querySelector('[data-native-chat-turn-activity]')
    if (
      !activity?.textContent?.includes('Running a command') ||
      !/\d+s/.test(activity.textContent)
    ) {
      throw new Error('The single live tail must show activity and elapsed time')
    }
  }
})
