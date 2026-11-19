import { Layout, visibleFixture } from './native-chat-milestone-layout-test-fixture'
import { nativeChatAgentRows } from '../../../../shared/native-chat/transcript/subagents/native-chat-agent-rows'

const agentRows = nativeChatAgentRows(
  [
    {
      id: 'review',
      label: 'Review milestone accuracy',
      state: 'working',
      startedAt: Date.now() - 60000
    },
    {
      id: 'tests',
      label: 'Verify persistence',
      state: 'completed',
      startedAt: Date.now() - 120000,
      settledAt: Date.now() - 30000,
      tokens: 14500,
      lastMessage: 'Persistence and reconnect checks passed.'
    }
  ],
  [
    {
      id: 'host-review',
      providerId: 'review',
      kind: 'agent',
      name: 'Review milestone accuracy',
      model: 'gpt-6.2-sol',
      state: 'working',
      membership: 'live',
      firstObservedAt: Date.now() - 60000,
      observedAt: Date.now(),
      operation: {
        toolName: 'exec_command',
        input: 'pnpm test milestone-save.test.ts',
        basis: 'open',
        observedAt: Date.now()
      },
      totalTokens: 8100,
      stoppable: true,
      invocation: { invocationId: 'review-run', generation: 1 }
    }
  ],
  {
    parentEvidenceFresh: true,
    transportObservation: 'live',
    parentObservedAt: Date.now(),
    hostClockOffsetMs: 0
  }
)
const selectAgents = async (frame: HTMLElement) => {
  const tab = [...frame.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (button) => button.textContent?.startsWith('Agents') && button.getBoundingClientRect().width > 0
  )
  if (!tab) {
    throw new Error('Agents tab must be available')
  }
  tab.focus()
  tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  tab.click()
  // Radix tabs select on mouse-down, including in the fixture host.
  tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  if (tab.getAttribute('aria-selected') !== 'true') {
    throw new Error('Agents tab must select')
  }
}
export const agents = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} agentRows={agentRows} />,
  interact: selectAgents
})
export const agentsNarrow = visibleFixture({
  width: 360,
  render: () => <Layout width={360} agentRows={agentRows} />,
  interact: selectAgents
})
export const agentsEmpty = visibleFixture({
  width: 720,
  render: () => <Layout width={720} />,
  interact: selectAgents
})
export const agentDetails = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} agentRows={agentRows} />,
  interact: async (frame) => {
    await selectAgents(frame)
    const row = [...frame.querySelectorAll<HTMLButtonElement>('li button')].find((button) =>
      button.textContent?.includes('Review milestone accuracy')
    )
    row?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (
      ![...frame.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('Open transcript')
      )
    ) {
      throw new Error('Agent details must offer its recorded transcript')
    }
  }
})

const backgroundRows = nativeChatAgentRows(
  [],
  [
    {
      id: 'push',
      kind: 'command',
      name: 'Wait for push to finish',
      state: 'working',
      membership: 'live',
      firstObservedAt: Date.now() - 120000,
      observedAt: Date.now(),
      stoppable: false,
      invocation: { invocationId: 'push-run', generation: 1 }
    }
  ],
  {
    parentEvidenceFresh: true,
    transportObservation: 'live',
    parentObservedAt: Date.now(),
    hostClockOffsetMs: 0
  }
)
export const backgroundOnly = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} agentRows={backgroundRows} />,
  interact: selectAgents
})
export const mixedWork = visibleFixture({
  width: 360,
  render: () => <Layout width={360} agentRows={[...agentRows, ...backgroundRows]} />,
  interact: selectAgents
})
