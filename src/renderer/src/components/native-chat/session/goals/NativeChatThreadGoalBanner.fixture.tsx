import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { NativeChatThreadGoalBanner } from './NativeChatThreadGoalBanner'
import { PromptBar } from '../../beautiful-ui/PromptBar'
import { nativeChatAppearanceStyle } from '../../appearance/native-chat-appearance-style'

function Goal() {
  return (
    <div className="native-chat-appearance bg-chat-canvas" style={nativeChatAppearanceStyle({})}>
      <NativeChatThreadGoalBanner
        goal={{
          objective: 'Resume and keep going',
          status: 'active',
          tokenBudget: null,
          tokensUsed: 0,
          timeUsedSeconds: 900,
          createdAt: 1,
          updatedAt: 1
        }}
        pending={false}
        hostChanges
        sendUnavailable={false}
        isVisible={false}
        runningTurn={null}
        onChange={() => {}}
      />
      <div className="px-4 pt-2 pb-4">
        <PromptBar expanded launch={false}>
          <div className="h-24" />
        </PromptBar>
      </div>
    </div>
  )
}
export const collapsed = defineFixture({ width: 640, render: () => <Goal /> })
export const expanded = defineFixture({
  width: 640,
  render: () => <Goal />,
  interact: async (frame) => {
    const toggle = frame.querySelector<HTMLButtonElement>('button[aria-expanded]')
    if (!toggle || toggle.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Expected collapsed goal')
    }
    const before = frame.getBoundingClientRect().height
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (
      toggle.getAttribute('aria-expanded') !== 'true' ||
      frame.getBoundingClientRect().height <= before
    ) {
      throw new Error('Expanding a short goal must reveal its details')
    }
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (frame.getBoundingClientRect().height !== before) {
      throw new Error('Collapsing must hide goal details')
    }
    toggle.click()
  }
})
