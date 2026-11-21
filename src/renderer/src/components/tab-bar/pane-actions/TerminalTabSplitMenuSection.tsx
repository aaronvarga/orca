import { splitNativeChatTab } from '../../native-chat/pane/routing/native-chat-tab-split-actions'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger
} from '@/components/ui/context-menu'
import { PanelBottomClose, PanelRightClose, SquareTerminal } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { TabWorkspaceLayoutMenuSection } from './TabWorkspaceLayoutMenuSection'
import { requestActiveTerminalPaneSplit } from './request-active-terminal-pane-split'
import { cn } from '@/lib/class-names'

export function TerminalTabSplitMenuSection({
  unifiedTabId,
  groupId,
  tabId,
  isActive,
  onActivate,
  splitRightShortcut,
  splitDownShortcut,
  showTerminalSplit = true,
  chatWorktreeId,
  trailingSeparator = false
}: {
  unifiedTabId: string
  groupId: string
  tabId: string
  isActive: boolean
  onActivate: (tabId: string) => void
  splitRightShortcut: string
  splitDownShortcut: string
  chatWorktreeId?: string
  showTerminalSplit?: boolean
  trailingSeparator?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const splitActiveTerminalPane = (direction: 'vertical' | 'horizontal'): void => {
    if (!isActive) {
      onActivate(tabId)
    }
    requestActiveTerminalPaneSplit({ tabId, direction })
  }

  return (
    <>
      <TabWorkspaceLayoutMenuSection unifiedTabId={unifiedTabId} groupId={groupId} />
      {showTerminalSplit || chatWorktreeId ? (
        <ContextMenuSub>
          <ContextMenuSubTrigger className="[&>svg:last-child]:size-3.5">
            <SquareTerminal className="size-3.5 shrink-0" />
            {chatWorktreeId
              ? t('chatSplits.menu', 'Split chat')
              : t(
                  'auto.components.tab.bar.TerminalTabSplitMenuSection.splitTerminal',
                  'Split terminal'
                )}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent
            animation="none"
            className={cn('min-w-[12rem]', 'max-w-[calc(100vw-1rem)] whitespace-nowrap')}
          >
            <ContextMenuItem
              onSelect={() =>
                chatWorktreeId
                  ? splitNativeChatTab(chatWorktreeId, unifiedTabId, 'right')
                  : splitActiveTerminalPane('vertical')
              }
            >
              <PanelRightClose className="size-3.5 shrink-0" />
              {chatWorktreeId
                ? t('chatSplits.right', 'Split chat right')
                : t(
                    'auto.components.tab.bar.SortableTabContextMenu.splitTerminalRight',
                    'Split terminal right'
                  )}
              <ContextMenuShortcut>{splitRightShortcut}</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() =>
                chatWorktreeId
                  ? splitNativeChatTab(chatWorktreeId, unifiedTabId, 'down')
                  : splitActiveTerminalPane('horizontal')
              }
            >
              <PanelBottomClose className="size-3.5 shrink-0" />
              {chatWorktreeId
                ? t('chatSplits.down', 'Split chat down')
                : t(
                    'auto.components.tab.bar.SortableTabContextMenu.splitTerminalDown',
                    'Split terminal down'
                  )}
              <ContextMenuShortcut>{splitDownShortcut}</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      ) : null}
      {trailingSeparator ? <ContextMenuSeparator /> : null}
    </>
  )
}
