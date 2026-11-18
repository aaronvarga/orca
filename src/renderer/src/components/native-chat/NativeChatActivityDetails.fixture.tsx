import { defineFixture } from '../../component-fixtures/component-fixture'
import { nativeChatAppearanceStyle } from './appearance/native-chat-appearance-style'
import { NativeChatToolRun } from './tools/runs/NativeChatToolRun'
import { NativeChatTaskList } from './tools/tasks/NativeChatTaskList'
import type { NativeChatBlock } from '../../../../shared/native-chat/native-chat-types'

const blocks: NativeChatBlock[] = [
  ...[
    'flavors.css',
    'ChurnSchedule.tsx',
    'menu.ts',
    'src/a-very-long-folder-name/preferences.ts'
  ].flatMap((path, index): NativeChatBlock[] => [
    {
      type: 'tool-call',
      callId: `edit-${index}`,
      name: 'Edit',
      state: 'completed',
      input: {
        file_path: `/projects/orca/${path}`,
        old_string: 'old value',
        new_string: 'new value\nconfirmed extra line'
      }
    },
    { type: 'tool-result', callId: `edit-${index}`, output: 'Updated file' }
  ]),
  {
    type: 'tool-call',
    callId: 'failed-edit',
    name: 'Edit',
    state: 'failed',
    input: { file_path: '/projects/orca/not-changed.ts', old_string: 'old', new_string: 'new' }
  },
  { type: 'tool-result', callId: 'failed-edit', output: 'Permission denied', isError: true }
]

function ActivityDetails({ fontSize = 13 }: { fontSize?: number }) {
  return (
    <div
      className="native-chat-appearance space-y-5 bg-chat-canvas p-4"
      style={nativeChatAppearanceStyle({ nativeChatAppearance: { fontSize } })}
    >
      <NativeChatToolRun
        blocks={blocks}
        expandSignal={false}
        disclosureId="activity-details"
        backgroundTasks={[
          {
            type: 'background-task',
            taskId: 'verified',
            kind: 'command',
            label: 'Verify vendor records',
            state: 'done',
            summary: 'Verified all imported records.',
            tokens: 1200,
            startedAt: 1000,
            settledAt: 5000
          },
          {
            type: 'background-task',
            taskId: 'running',
            kind: 'agent',
            label: 'Build reorder task list',
            state: 'working',
            summary: 'Reading the current inventory export.'
          },
          {
            type: 'background-task',
            taskId: 'failed',
            kind: 'workflow',
            label: 'Draft supplier emails',
            state: 'blocked',
            error: 'The provider rejected the request. Reconnect the account before trying again.',
            outputFile: '/projects/orca/reports/supplier-email-errors.log'
          }
        ]}
      />
      <NativeChatTaskList
        disclosureKey="activity-plan"
        list={{
          tasks: [
            { content: 'Verify vendor records', status: 'completed' },
            {
              content: 'Build reorder task list',
              activeForm: 'Reading the current inventory export',
              status: 'in_progress'
            },
            {
              content: 'Draft supplier emails with the confirmed reorder quantities',
              status: 'pending'
            }
          ]
        }}
      />
    </div>
  )
}

export const desktop = defineFixture({ width: 720, render: () => <ActivityDetails /> })
export const expanded = defineFixture({
  ...desktop,
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('[data-native-chat-tool-run-state]')?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    frame
      .querySelector<HTMLButtonElement>('button[aria-label^="/projects/orca/flavors.css +"]')
      ?.click()
    Array.from(frame.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('Draft supplier emails'))
      ?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
})
export const narrow = defineFixture({ width: 320, render: () => <ActivityDetails /> })
export const enlarged = defineFixture({
  width: 320,
  render: () => <ActivityDetails fontSize={20} />
})
