import type { NativeChatResolvedPrompt } from '../../../../shared/native-chat/input/questions/native-chat-resolution-receipt'
import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import { useAppStore } from '@/store'
import { NativeChatAgentVisualizerContext } from './subagents/NativeChatAgentVisualizer'
import type { AgentChildRowModel } from '../../../../shared/agent-status/presentation/agent-child-row-model'
import { NativeChatComposerTabStrip } from './composer/controls/NativeChatComposerTabStrip'
import { NativeChatMilestoneGenerationContext } from './tools/tasks/NativeChatMilestoneGeneration'
import { NativeChatBackgroundTasksStatus } from './tools/tasks/NativeChatBackgroundTasksStatus'
import {
  NativeChatMilestoneVisibilityProvider,
  NativeChatMilestoneToggle
} from './tools/tasks/NativeChatMilestoneVisibility'
import type { CSSProperties } from 'react'
import { PromptBar } from './beautiful-ui/PromptBar'
import {
  NATIVE_CHAT_TRANSCRIPT_COLUMN_CLASS,
  nativeChatTranscriptOuterClass
} from './appearance/native-chat-appearance-style'
import { defineFixture, type ComponentFixture } from '../../component-fixtures/component-fixture'
import {
  NativeChatMilestoneComposer,
  NativeChatMilestoneComposerSlot,
  NativeChatMilestoneLayout
} from './tools/tasks/NativeChatMilestoneLayout'
import type { NativeChatMilestones } from '../../../../shared/native-chat/input/task-lists/native-chat-milestones'

const generationTransport = {
  regenerateMilestones: async () => {
    throw new Error('Fixture host unavailable')
  }
}

export const list: NativeChatMilestones = {
  updatedAt: Date.now() - 12 * 60000,
  tasks: [
    {
      id: '1',
      content: 'Understand the approved implementation phases',
      activeForm: 'Compared the approved plan with the current implementation.',
      status: 'completed',
      timing: { elapsedMs: 95000, estimate: '~2–4 min' }
    },
    {
      id: '2',
      content:
        'Implement automatic milestones across both providers and remote folder workspaces with a long label that wraps naturally',
      status: 'in_progress',
      eta: '~2–4 min',
      details:
        '- Read Claude task events and Codex plan updates on the owning host.\n- Check reconnect recovery for issue #42 (https://example.com/issues/42).'
    },
    {
      id: '3',
      content: 'Verify persistence, reconnect recovery and responsive presentation',
      status: 'pending',
      eta: '~30–60 s',
      details: '- Check saved milestone recovery.\n- Check both narrow and wide pane layouts.'
    }
  ]
}
const NO_MESSAGES: readonly NativeChatMessage[] = []
const NO_AGENT_ROWS: AgentChildRowModel[] = []

export function Layout({
  width,
  plan = list,
  messages = NO_MESSAGES,
  receipts,
  agentRows = NO_AGENT_ROWS
}: {
  width: number
  plan?: NativeChatMilestones | null
  messages?: readonly NativeChatMessage[]
  receipts?: ReadonlyMap<string, NativeChatResolvedPrompt>
  agentRows?: AgentChildRowModel[]
}) {
  const style: CSSProperties & { '--chat-content-max-width': string } = {
    width,
    '--chat-content-max-width': '46rem'
  }
  return (
    <NativeChatAgentVisualizerContext
      value={{ rows: agentRows, incomplete: false, open: () => {} }}
    >
      <NativeChatMilestoneGenerationContext value={generationTransport}>
        <NativeChatMilestoneVisibilityProvider sessionId="fixture">
          <div
            className="native-chat-appearance @container/milestones [container-type:size] relative flex h-[640px] flex-col bg-chat-canvas"
            style={style}
          >
            <div
              data-fixture-toolbar
              className="absolute top-0 right-0 z-20 flex h-6 items-center bg-card px-3 text-xs text-foreground"
            >
              Pane controls
            </div>
            <NativeChatMilestoneLayout
              sessionId="fixture"
              messages={messages}
              receipts={receipts}
              milestones={plan}
              enabled
              working
            >
              <div className="relative min-w-0 flex-1">
                <div
                  data-native-chat-scroll
                  className="scrollbar-sleek h-full overflow-y-auto [scrollbar-gutter:stable_both-edges]"
                >
                  <div className="pr-(--native-chat-milestone-gutter)">
                    <div className={nativeChatTranscriptOuterClass(false)}>
                      <div
                        data-native-chat-transcript-column
                        className={NATIVE_CHAT_TRANSCRIPT_COLUMN_CLASS}
                      >
                        {Array.from({ length: 24 }, (_, index) => (
                          <p key={index} className="text-sm text-chat-foreground">
                            Conversation message {index + 1}. The transcript shares its center with
                            the composer below.
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div data-native-chat-rail className="absolute top-1/2 right-2.5 text-xs">
                  Navigation strip
                </div>
              </div>
            </NativeChatMilestoneLayout>
            <NativeChatMilestoneComposer enabled>
              <NativeChatBackgroundTasksStatus
                tasks={[
                  {
                    id: 'fixture-agent',
                    kind: 'agent',
                    state: 'working',
                    description: 'Check the implementation'
                  }
                ]}
                settledTasks={[]}
                supportsTaskStop={false}
                offersStopAll={false}
                stoppingTaskIds={new Set()}
                stoppingAll={false}
                indicatorActive={false}
                isVisible
                expanded={false}
                onExpandedChange={() => {}}
                onStop={() => {}}
              />
              <NativeChatMilestoneComposerSlot enabled={plan !== undefined} />
              <NativeChatComposerTabStrip attached data-native-chat-thread-goal="active">
                <span>Pursuing goal · Complete and verify the implementation</span>
              </NativeChatComposerTabStrip>
              <div className="px-3 pt-2 pb-3 sm:px-4">
                <div data-fixture-composer className="mx-auto max-w-(--chat-content-max-width)">
                  <PromptBar expanded launch={false}>
                    <NativeChatMilestoneToggle />
                    <div className="min-h-20 p-3 text-sm text-chat-foreground-faint">
                      Ask anything
                    </div>
                  </PromptBar>
                </div>
              </div>
            </NativeChatMilestoneComposer>
          </div>
        </NativeChatMilestoneVisibilityProvider>
      </NativeChatMilestoneGenerationContext>
    </NativeChatAgentVisualizerContext>
  )
}
export function milestoneFixture(fixture: ComponentFixture) {
  return defineFixture({
    ...fixture,
    store: {
      ...fixture.store,
      updateSettingsOrThrow: async (updates) => {
        const state = useAppStore.getState()
        if (state.settings) {
          useAppStore.setState({ settings: { ...state.settings, ...updates } })
        }
      }
    }
  })
}
export function visibleFixture(fixture: ComponentFixture) {
  return milestoneFixture({
    ...fixture,
    interact: async (frame) => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const header = [...frame.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) =>
          button.getBoundingClientRect().width > 0 &&
          button.textContent?.includes('Milestones') &&
          button.getAttribute('aria-expanded') === 'false'
      )
      if (header) {
        header.click()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
      await fixture.interact?.(frame)
    }
  })
}
