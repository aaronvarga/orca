import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  agentSessionFavoriteKey,
  type AgentSessionFavorite
} from '../../../../../../shared/ai-vault/contracts/agent-session-favorites'

const EMPTY_FAVORITES: readonly AgentSessionFavorite[] = []
let saving = Promise.resolve()

export function useAgentSessionFavorites() {
  return useAppStore((state) => state.settings?.agentSessionFavorites ?? EMPTY_FAVORITES)
}

export function setAgentSessionFavorite(
  favorite: AgentSessionFavorite,
  saved: boolean
): Promise<void> {
  const operation = saving.then(async () => {
    const state = useAppStore.getState()
    if (!state.settings) {
      throw new Error('Settings are not loaded')
    }
    const key = agentSessionFavoriteKey(favorite)
    const others = (state.settings.agentSessionFavorites ?? []).filter(
      (entry) => agentSessionFavoriteKey(entry) !== key
    )
    await state.updateSettingsOrThrow({
      agentSessionFavorites: saved ? [...others, favorite] : others
    })
  })
  saving = operation.catch(() => undefined)
  return operation.catch((error: unknown) => {
    toast.error(translate('aiVault.favorites.saveFailed', 'Could not save session favorites.'))
    console.error('Could not save session favorites:', error)
  })
}
