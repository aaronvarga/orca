import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { useAgentDetectionTargetForWorktree } from '@/lib/agent-session/launch/inventory/useAgentDetectionTarget'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { AgentSettingsMenuItem } from '@/components/agent/AgentSettingsMenuItem'
import { useNewTabAgentMenuRows } from '@/components/agent/launch-menu/use-new-tab-agent-menu-rows'
import { useTabAgentMenuLaunch } from '@/components/agent/launch-menu/AgentMenuItems'
import { chatUnavailableLabel } from '@/components/agent/launch-menu/agent-menu-row-presentation'
import { focusTerminalTabSurface } from '@/components/terminal-pane/input/focus/focus-terminal-tab-surface'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { landingChatRows } from './landing-chat-rows'

export function LandingNewChatButton({
  worktreeId,
  groupId
}: {
  worktreeId: string
  groupId: string
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const detectionTarget = useAgentDetectionTargetForWorktree(worktreeId)
  const model = useNewTabAgentMenuRows(worktreeId, open, detectionTarget)
  const launch = useTabAgentMenuLaunch({
    worktreeId,
    groupId,
    onFocusTerminal: focusTerminalTabSurface
  })
  const rows = model.state === 'settled' ? landingChatRows(model.rows) : []
  const unavailable =
    model.state === 'settled'
      ? model.rows.find((row) => row.kind === 'chat-unavailable')
      : undefined
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="size-4" />
          {t('components.tabGroup.splitPaneLanding.newChat', 'New chat…')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        {rows.map((row) => (
          <DropdownMenuItem
            key={row.agent}
            onSelect={(event) => {
              if (launch(row) === false) {
                event.preventDefault()
              }
            }}
          >
            <AgentIcon agent={row.agent} size={16} />
            {t('components.tabGroup.splitPaneLanding.newNamedChat', 'New {{agent}} chat', {
              agent: getAgentCatalog().find((agent) => agent.id === row.agent)?.label ?? row.agent
            })}
          </DropdownMenuItem>
        ))}
        {rows.length === 0 ? (
          <DropdownMenuItem disabled>
            {model.state === 'loading'
              ? t('components.tabGroup.splitPaneLanding.loadingChats', 'Loading chats…')
              : unavailable?.kind === 'chat-unavailable'
                ? chatUnavailableLabel(unavailable.reason, t)
                : t(
                    'components.tabGroup.splitPaneLanding.noChats',
                    'No chat agents available on this host'
                  )}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <AgentSettingsMenuItem
          onSelect={() => {
            useAppStore.getState().openSettingsTarget({ pane: 'agents', repoId: null })
            useAppStore.getState().openSettingsPage()
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
