import { useState } from 'react'
import { Loader2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { structuredAgentSessionTargetForHost } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import type { AiVaultHostScopeOption } from '../scope/ai-vault-host-scope'
import {
  aiVaultAgentLabel,
  type AiVaultSession
} from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import {
  agentSessionFavoriteKey,
  type AgentSessionFavorite
} from '../../../../../../shared/ai-vault/contracts/agent-session-favorites'
import {
  useAgentSessionFavorites,
  setAgentSessionFavorite
} from '../session-actions/agent-session-favorites'
import { resolveFavoriteAgentSession } from '../session-actions/resolve-favorite-agent-session'

async function openFavorite(
  favorite: AgentSessionFavorite,
  onOpen: (session: AiVaultSession, favorite: AgentSessionFavorite) => void | Promise<void>,
  setOpening: (key: string | null) => void,
  t: ReturnType<typeof useTranslate>
): Promise<void> {
  setOpening(agentSessionFavoriteKey(favorite))
  try {
    if (favorite.structuredSession) {
      const target = structuredAgentSessionTargetForHost(favorite.executionHostId)
      if (!target) {
        throw new Error(
          t('aiVault.favorites.hostUnavailable', 'This session’s host is unavailable.')
        )
      }
      await activateAiVaultStructuredSession(favorite, undefined, target)
      return
    }
    const session = await resolveFavoriteAgentSession(favorite, window.api.aiVault.listSessions)
    if (!session) {
      throw new Error(
        t(
          'aiVault.favorites.missing',
          'Could not find this session on its host. Refresh Agents and try again.'
        )
      )
    }
    await onOpen(session, favorite)
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : t('aiVault.favorites.openFailed', 'Could not reopen this session.')
    )
  } finally {
    setOpening(null)
  }
}

export function AgentSessionFavorites({
  onOpen,
  hosts
}: {
  onOpen: (session: AiVaultSession, favorite: AgentSessionFavorite) => void | Promise<void>
  hosts?: readonly AiVaultHostScopeOption[]
}) {
  const t = useTranslate()
  const favorites = useAgentSessionFavorites()
  const [opening, setOpening] = useState<string | null>(null)
  const open = (favorite: AgentSessionFavorite): void => {
    if (!opening) {
      void openFavorite(favorite, onOpen, setOpening, t)
    }
  }
  if (favorites.length === 0) {
    return null
  }
  const removeLabel = t('aiVault.favorites.remove', 'Remove from Favorites')
  return (
    <section
      aria-label={t('aiVault.favorites.title', 'Favorites')}
      className="shrink-0 border-b border-sidebar-border"
    >
      <h3 className="px-3 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('aiVault.favorites.title', 'Favorites')}
      </h3>
      <div className="max-h-48 overflow-y-auto scrollbar-sleek">
        {favorites.map((favorite) => {
          const key = agentSessionFavoriteKey(favorite)
          const hostLabel = hosts?.find((host) => host.id === favorite.executionHostId)?.label
          return (
            <div key={key} className="flex min-w-0 items-center gap-1 px-2 hover:bg-sidebar-accent">
              <button
                type="button"
                disabled={opening !== null}
                onClick={() => void open(favorite)}
                className="min-w-0 flex-1 rounded-sm px-1 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-sm">
                  {opening === key ? (
                    <Loader2
                      aria-hidden
                      className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                    />
                  ) : null}
                  <span className="truncate">{favorite.title}</span>
                </span>
                <span className="block truncate text-2xs text-muted-foreground">
                  {aiVaultAgentLabel(favorite.agent)}
                  {favorite.executionHostId !== 'local' && hostLabel ? ` · ${hostLabel}` : ''}
                  {favorite.cwd ? ` · ${favorite.cwd}` : ''}
                </span>
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={removeLabel}
                    disabled={opening !== null}
                    onClick={() => void setAgentSessionFavorite(favorite, false)}
                  >
                    <Star className="size-3.5" fill="currentColor" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  {removeLabel}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        })}
      </div>
    </section>
  )
}
