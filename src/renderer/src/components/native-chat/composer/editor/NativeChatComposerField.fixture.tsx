import { useRef, useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { useImeEnterGestureOwnership } from '@/lib/text-input/ime/ime-composition-keyboard-event'
import { nativeChatAppearanceStyle } from '../../appearance/native-chat-appearance-style'
import { NativeChatComposerField } from './NativeChatComposerField'
import type { NativeChatComposerInput } from './native-chat-composer-input'
import type {
  SessionOptionDescriptor,
  SessionOptionsSurface
} from '../../../../../../shared/native-chat/input/native-chat-session-options'

const options: SessionOptionDescriptor[] = [
  {
    id: 'model',
    label: 'Model',
    category: 'model',
    transport: 'agent-session',
    settable: true,
    valueSource: 'applied',
    kind: {
      type: 'select',
      currentValue: 'example',
      choices: [{ value: 'example', label: 'Example model with a long name' }]
    }
  }
]
const surface: SessionOptionsSurface = {
  getSnapshot: () => options,
  subscribe: () => () => {},
  setOption: async () => ({ snapshot: options }),
  invokeAction: async () => ({ snapshot: options })
}

function noop(): void {}

function Composer({ fontSize = 13 }: { fontSize?: number }) {
  const [draft, setDraft] = useState('')
  const input = useRef<NativeChatComposerInput | null>(null)
  const ime = useImeEnterGestureOwnership()
  return (
    <div
      className="native-chat-appearance bg-chat-canvas py-4"
      style={nativeChatAppearanceStyle({ nativeChatAppearance: { fontSize } })}
    >
      <NativeChatComposerField
        draftScopeKey="beautiful-ui-input"
        agent="codex"
        textareaRef={input}
        draft={draft}
        disabled={false}
        hasPty
        canSend
        autocomplete={{ mode: 'none' }}
        mentionFiles={{ files: [], loading: false, failed: false }}
        activeSuggestion={0}
        notices={[]}
        imageAttachments={[]}
        sendButtonDisabled={!draft}
        isWorking={false}
        hasDraft={draft.length > 0}
        attachDisabled={false}
        dictationDisabled
        isDictating={false}
        isDictationHoldMode={false}
        imeEnterGesture={ime}
        onDraftChange={setDraft}
        onTextareaSelect={noop}
        onKeyDown={noop}
        onImeSettled={noop}
        onPaste={noop}
        pickerListboxId="beautiful-ui-picker"
        onChoosePickerItem={noop}
        onRetrySkills={noop}
        onChooseMentionFile={noop}
        onRemoveImageAttachment={noop}
        onAttach={noop}
        onDictationToggle={noop}
        onDictationHoldStart={noop}
        onDictationHoldEnd={noop}
        onSend={() => setDraft('')}
        sessionOptionsSurface={surface}
        sessionOptionsSnapshot={options}
      />
    </div>
  )
}

export const desktop = defineFixture({ width: 768, render: () => <Composer /> })
export const narrow = defineFixture({ width: 320, render: () => <Composer /> })
export const enlarged = defineFixture({ width: 320, render: () => <Composer fontSize={20} /> })
