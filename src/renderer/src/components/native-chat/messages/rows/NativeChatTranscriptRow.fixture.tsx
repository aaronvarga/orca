import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { NativeChatMessageList } from '../../NativeChatMessageList'
import type { NativeChatLiveSession } from '../../session/terminal/read/native-chat-live-session-contract'
import type { NativeChatMessage } from '../../../../../../shared/native-chat/native-chat-types'
import { orchestrationMailFixture } from '../../../../../../shared/agent-session/orchestration-mail.test-fixture'

const STARTED_AT = 1_800_000_000_000
let sent = 0
function at(): number {
  sent += 1
  return STARTED_AT + sent * 60_000
}
function text(id: string, role: NativeChatMessage['role'], body: string): NativeChatMessage {
  return { id, role, source: 'transcript', timestamp: at(), blocks: [{ type: 'text', text: body }] }
}

// What follows a response's copy / fork / scroll-up row: a worker's card, the person's own bubble,
// and the turn's changed-files rollup.
const messages: NativeChatMessage[] = [
  text('ask', 'user', 'Have a worker review the parser.'),
  text('dispatched', 'assistant', 'A review worker is on it. I will report when it answers.'),
  {
    ...orchestrationMailFixture({ body: 'The parser review found nothing blocking.' }),
    timestamp: at()
  },
  text('reported', 'assistant', 'The worker found nothing blocking.'),
  text('follow-up', 'user', 'Good. Update the greeting too.'),
  {
    id: 'edit',
    role: 'assistant',
    source: 'transcript',
    timestamp: at(),
    blocks: [
      {
        type: 'tool-call',
        name: 'Edit',
        state: 'completed',
        input: {
          file_path: '/Users/alice/orca/workspaces/orca/feature-x/src/components/greeting.ts',
          old_string: 'return "Hello"',
          new_string: 'return `Hello, ${name}`'
        }
      },
      { type: 'tool-result', output: 'The file was updated successfully.' }
    ]
  },
  text('answer', 'assistant', 'The greeting now includes the name.')
]

const session: NativeChatLiveSession = {
  messages,
  agent: 'claude',
  sessionId: 'fixture',
  status: 'ready',
  readPhase: 'ready',
  hasMore: false,
  loadingEarlier: false,
  olderHistoryGeneration: 0,
  loadEarlier: async () => 'applied'
}

export const responseActionsGap = defineFixture({
  width: 560,
  render: () => (
    <div className="flex h-[520px] flex-col">
      <NativeChatMessageList session={session} isWorking={false} expandSignal={false} />
    </div>
  )
})

export const responsiveSplits = defineFixture({
  width: 720,
  render: () => (
    <div className="native-chat-appearance flex h-[640px]">
      {[0, 1].map((index) => (
        <div key={index} data-fixture-chat-pane className="flex min-w-0 flex-1 flex-col">
          <NativeChatMessageList
            session={{
              ...session,
              messages: [
                text(
                  `response-${index}`,
                  'assistant',
                  'Each split must wrap this explanation to its own width, keeping every sentence readable when the neighboring chat is resized.\n\n' +
                    '| Endpoint | Permission | Description |\n| --- | --- | --- |\n' +
                    '| GET /registry/organizations/engineering/projects/recordings/transcripts | Registry.Read | Read the recording metadata and transcript for the selected project. |'
                )
              ]
            }}
            isWorking={false}
            expandSignal={false}
          />
        </div>
      ))}
    </div>
  ),
  interact: (frame) => {
    for (const pane of frame.querySelectorAll<HTMLElement>('[data-fixture-chat-pane]')) {
      const viewport = pane
        .querySelector<HTMLElement>('[data-native-chat-scroll]')!
        .getBoundingClientRect()
      const bounds = pane.getBoundingClientRect()
      if (viewport.width > bounds.width + 1 || viewport.right > bounds.right + 1) {
        throw new Error('Each transcript viewport must fit its own split pane')
      }
    }
  }
})

export const compactToolRuns = defineFixture({
  width: 740,
  render: () => (
    <div className="native-chat-appearance flex h-[480px] flex-col">
      <NativeChatMessageList
        session={{
          ...session,
          messages: [
            text(
              'intro',
              'assistant',
              'I will check the project settings and update the selected account.'
            ),
            ...[3, 2].flatMap((count, index): NativeChatMessage[] => [
              {
                id: `integrations-${index}`,
                role: 'assistant',
                source: 'transcript',
                timestamp: at(),
                blocks: Array.from({ length: count }, (_, call) => ({
                  type: 'tool-call',
                  name: `mcp__project__read_settings_${call}`,
                  callId: `call-${index}-${call}`,
                  state: 'completed',
                  input: {}
                }))
              },
              text(
                `progress-${index}`,
                'assistant',
                index === 0
                  ? 'The account is ready. I will switch the project settings to the selected domain.'
                  : 'The settings have been checked and the account update is complete.'
              )
            ])
          ]
        }}
        isWorking={false}
        expandSignal={false}
      />
    </div>
  )
})

export const milestoneRefreshNotices = defineFixture({
  width: 740,
  render: () => (
    <div className="native-chat-appearance flex h-[320px] flex-col">
      <NativeChatMessageList
        session={{
          ...session,
          messages: [
            ...[0, 1, 2].map((index): NativeChatMessage => ({
              id: `refresh-${index}`,
              role: 'system',
              source: 'transcript',
              timestamp: at(),
              blocks: [
                {
                  type: 'text',
                  text: 'Milestones regenerated.',
                  presentation: 'session-milestones'
                }
              ]
            })),
            text(
              'progress-after-refresh',
              'assistant',
              'The current milestones are ready. Continuing with the project settings.'
            )
          ]
        }}
        isWorking={false}
        expandSignal={false}
      />
    </div>
  )
})
