import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  nativeChatMilestonePanelPreferences,
  type NativeChatMilestonePanelPreferences
} from '../../../../../../shared/native-chat/settings/native-chat-milestone-panel'
import { MAX_NATIVE_CHAT_DISCLOSURES } from '../../messages/disclosure/native-chat-disclosure-store'

let saving = Promise.resolve()

export function useNativeChatMilestonePreferences(sessionId?: string) {
  const saved = useAppStore(
    useShallow((state) =>
      sessionId ? state.settings?.nativeChatMilestonePanels?.[sessionId] : undefined
    )
  )
  const [draft, setDraft] = useState<{
    sessionId: string | undefined
    value: NativeChatMilestonePanelPreferences
  } | null>(null)
  const preferences =
    draft && draft.sessionId === sessionId
      ? draft.value
      : nativeChatMilestonePanelPreferences(saved)
  const change = (patch: Partial<NativeChatMilestonePanelPreferences>) => {
    setDraft({ sessionId, value: { ...preferences, ...patch } })
    if (!sessionId) {
      return
    }
    saving = saving
      .then(async () => {
        const state = useAppStore.getState()
        if (!state.settings) {
          return
        }
        const records = state.settings.nativeChatMilestonePanels ?? {}
        const entries = Object.entries(records)
          .filter(([key]) => key !== sessionId)
          .slice(-(MAX_NATIVE_CHAT_DISCLOSURES - 1))
        await state.updateSettingsOrThrow({
          nativeChatMilestonePanels: Object.fromEntries([
            ...entries,
            [sessionId, { ...nativeChatMilestonePanelPreferences(records[sessionId]), ...patch }]
          ])
        })
      })
      .catch((error) => console.error('Could not save milestone panel preferences:', error))
  }
  return { preferences, change }
}
