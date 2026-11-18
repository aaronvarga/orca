import { useNativeChatPickerFocusReturn } from '../focus/native-chat-picker-focus-return'
import { useState } from 'react'
import { Play } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { workspaceTabs } from '@/lib/agent-session/tab-identity/structured-chat-tab-index'
import { useNativeChatTabOwnerWorktreeId } from '../../pane/ownership/use-native-chat-tab-owner'
import { useNativeChatQuickCommandsMenu } from '../../pane/actions/use-native-chat-quick-commands-menu'

export function NativeChatComposerQuickCommands({
  tabId,
  onInsert,
  focusComposer,
  disabled
}: {
  tabId: string
  onInsert: (text: string) => void
  focusComposer?: () => void
  disabled?: boolean
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const focusReturn = useNativeChatPickerFocusReturn(focusComposer)
  const worktreeId = useNativeChatTabOwnerWorktreeId(tabId)
  const groupId = useAppStore((state) =>
    worktreeId
      ? workspaceTabs(state.unifiedTabsByWorktree, worktreeId)?.find((tab) =>
          tab.contentType === 'terminal' ? tab.entityId === tabId : tab.id === tabId
        )?.groupId
      : undefined
  )
  const commands = useNativeChatQuickCommandsMenu(
    worktreeId && groupId ? { worktreeId, groupId } : undefined,
    () => setOpen(false),
    false,
    (text) => {
      focusReturn.notePick()
      onInsert(text)
    }
  )
  if (!worktreeId || !groupId) {
    return null
  }
  const label = t('auto.components.terminal.pane.TerminalContextMenu.ec85df5914', 'Quick Commands')
  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                ref={focusReturn.triggerRef}
                disabled={disabled}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                className="pointer-coarse:size-11"
              >
                <Play className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {label}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          side="top"
          align="start"
          className="w-60"
          onInteractOutside={focusReturn.onInteractOutside}
          onCloseAutoFocus={focusReturn.onCloseAutoFocus}
        >
          {commands.menu}
        </DropdownMenuContent>
      </DropdownMenu>
      {commands.dialog}
    </>
  )
}
