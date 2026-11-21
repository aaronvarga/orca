import { Star } from 'lucide-react'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import {
  agentSessionFavoriteKey,
  type AgentSessionFavorite
} from '../../../../../../shared/ai-vault/contracts/agent-session-favorites'
import {
  setAgentSessionFavorite,
  useAgentSessionFavorites
} from '../session-actions/agent-session-favorites'

export function AgentSessionFavoriteMenuItem({
  session,
  menuKind = 'context'
}: {
  session: AgentSessionFavorite
  menuKind?: 'context' | 'dropdown'
}) {
  const t = useTranslate()
  const favorites = useAgentSessionFavorites()
  const saved = favorites.some(
    (favorite) => agentSessionFavoriteKey(favorite) === agentSessionFavoriteKey(session)
  )
  const Item = menuKind === 'context' ? ContextMenuItem : DropdownMenuItem
  return (
    <Item onSelect={() => void setAgentSessionFavorite(session, !saved)}>
      <Star className="size-3.5" fill={saved ? 'currentColor' : 'none'} />
      {saved
        ? t('aiVault.favorites.remove', 'Remove from Favorites')
        : t('aiVault.favorites.add', 'Favorite Session')}
    </Item>
  )
}
