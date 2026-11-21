import { defineFixture } from '../../../component-fixtures/component-fixture'
import { NativeChatQuestionCard } from './NativeChatQuestionCard'

function DockedQuestion({ height }: { height: number }) {
  return (
    <div
      className="native-chat-appearance flex flex-col [container-type:size] bg-chat-canvas"
      style={{ height }}
    >
      <div className="min-h-0 flex-1 p-4 text-sm text-chat-foreground">Conversation</div>
      <div className="shrink-0">
        <NativeChatQuestionCard
          prompt={{
            questions: [
              {
                question:
                  'The account needs you to finish signing in before the agent can continue. Which account should be used for the project?',
                multiSelect: false,
                options: [
                  {
                    label: 'Use the project administrator account',
                    description:
                      'Finish signing in with the account that manages the workspace. The agent can then check the domain settings and routing.'
                  },
                  {
                    label: 'Use a different account',
                    description:
                      'Switch to the account assigned to this project before continuing. Existing sessions and project files will remain available.'
                  },
                  {
                    label: 'Continue after reviewing the settings',
                    description:
                      'Review the account and permissions in the open app, then return here to continue with the selected account.'
                  }
                ]
              }
            ]
          }}
          onAnswer={() => {}}
          onCancel={() => {}}
        />
      </div>
    </div>
  )
}
export const roomyDockedQuestion = defineFixture({
  width: 700,
  render: () => <DockedQuestion height={800} />,
  interact: (frame) => {
    const options = frame.querySelector('[data-native-chat-question-surface]')!.firstElementChild!
    if (options.scrollHeight > options.clientHeight + 1) {
      throw new Error(
        'Questions should show all choices without scrolling when the chat pane has room'
      )
    }
  }
})
export const shortDockedQuestion = defineFixture({
  width: 560,
  render: () => <DockedQuestion height={320} />,
  interact: (frame) => {
    const answer = frame.querySelector('[data-native-chat-answer-field]')!.getBoundingClientRect()
    const pane = frame.firstElementChild!.getBoundingClientRect()
    if (answer.bottom > pane.bottom || answer.top < pane.top) {
      throw new Error('The answer row must stay inside a short chat pane')
    }
  }
})
