import type { TabGroup, Tab } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import { useRef } from 'react'
import {
  PanelLeftClose,
  PanelRightClose,
  PanelBottomClose,
  Copy,
  Move,
  Maximize2,
  Minimize2,
  LayoutGrid,
  X,
  type LucideIcon
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  clampFloatingTerminalBounds,
  type FloatingTerminalPanelBounds
} from '@/components/floating-terminal/geometry/floating-terminal-panel-bounds'
import { moveTabToGroup } from '@/components/tab-bar/pane-actions/tab-move-to-pane-column'
import {
  useWorkspacePanePresentation,
  workspacePanePresentationKey,
  toggleWorkspacePanePresentation
} from './workspace-pane-presentation'
import { equalizeWorkspacePanes } from './equalize-workspace-panes'

const EMPTY_GROUPS: TabGroup[] = []
const EMPTY_TABS: Tab[] = []

export function WorkspacePaneToolbar({
  worktreeId,
  groupId,
  onClose,
  canClose = true,
  onEqualize
}: {
  worktreeId: string
  groupId: string
  onClose: () => void
  canClose?: boolean
  onEqualize?: () => void
}) {
  const t = useTranslate()
  const groups = useAppStore((state) => state.groupsByWorktree[worktreeId] ?? EMPTY_GROUPS)
  const tabs = useAppStore((state) => state.unifiedTabsByWorktree[worktreeId] ?? EMPTY_TABS)
  const key = workspacePanePresentationKey(worktreeId, groupId)
  const presentation = useWorkspacePanePresentation((state) => state.panes[key])
  const drag = useRef<{
    x: number
    y: number
    pointerId: number
    bounds: FloatingTerminalPanelBounds
  } | null>(null)
  const source = tabs.find(
    (tab) => tab.id === groups.find((group) => group.id === groupId)?.activeTabId
  )
  const split = (direction: 'left' | 'right' | 'down') =>
    useAppStore.getState().createEmptySplitGroup(worktreeId, groupId, direction, { landing: true })
  const actions: { label: string; Icon: LucideIcon; run: () => void; disabled?: boolean }[] = [
    {
      label: t('paneToolbar.splitLeft', 'Split Left'),
      Icon: PanelLeftClose,
      run: () => split('left')
    },
    {
      label: t('paneToolbar.splitRight', 'Split Right'),
      Icon: PanelRightClose,
      run: () => split('right')
    },
    {
      label: t('paneToolbar.splitDown', 'Split Down'),
      Icon: PanelBottomClose,
      run: () => split('down')
    },
    {
      label: presentation?.floating
        ? t('paneToolbar.dock', 'Dock Pane')
        : t('paneToolbar.float', 'Float Pane'),
      Icon: Copy,
      run: () => toggleWorkspacePanePresentation(key, 'float')
    },
    {
      label: presentation?.maximized
        ? t('paneToolbar.restore', 'Restore Pane')
        : t('paneToolbar.maximize', 'Maximize Pane'),
      Icon: presentation?.maximized ? Minimize2 : Maximize2,
      run: () => toggleWorkspacePanePresentation(key, 'maximize')
    },
    {
      label: t('paneToolbar.equalize', 'Equalize Splits'),
      Icon: LayoutGrid,
      run: () => {
        equalizeWorkspacePanes(worktreeId)
        onEqualize?.()
      },
      disabled: groups.length < 2 && !onEqualize
    },
    { label: t('paneToolbar.close', 'Close Pane'), Icon: X, run: onClose, disabled: !canClose }
  ]
  const moveLabel = t('paneToolbar.move', 'Move Pane')
  return (
    <div className="flex shrink-0 items-center gap-0">
      {actions.map(({ label, Icon, run, disabled }, index) => (
        <div key={label} className="contents">
          {index === 4 ? (
            <DropdownMenu modal={false}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="pane-title"
                      size="icon-xs"
                      aria-label={moveLabel}
                      disabled={!presentation?.floating && (!source || groups.length < 2)}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        if (
                          !presentation?.floating ||
                          presentation.maximized ||
                          event.button !== 0
                        ) {
                          return
                        }
                        event.preventDefault()
                        drag.current = {
                          x: event.clientX,
                          y: event.clientY,
                          pointerId: event.pointerId,
                          bounds: presentation.bounds
                        }
                        event.currentTarget.setPointerCapture(event.pointerId)
                      }}
                      onPointerMove={(event) => {
                        if (!drag.current || drag.current.pointerId !== event.pointerId) {
                          return
                        }
                        const store = useWorkspacePanePresentation.getState()
                        const current = store.panes[key]
                        if (current) {
                          store.set(key, {
                            ...current,
                            bounds: clampFloatingTerminalBounds({
                              ...drag.current.bounds,
                              left: drag.current.bounds.left + event.clientX - drag.current.x,
                              top: drag.current.bounds.top + event.clientY - drag.current.y
                            })
                          })
                        }
                      }}
                      onPointerUp={() => {
                        drag.current = null
                      }}
                      onLostPointerCapture={() => {
                        drag.current = null
                      }}
                    >
                      <Move className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">{moveLabel}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {groups
                  .filter((group) => group.id !== groupId)
                  .map((group, i) => (
                    <DropdownMenuItem
                      key={group.id}
                      onSelect={() => {
                        if (source) {
                          moveTabToGroup({ worktreeId, unifiedTabId: source.id, groupId: group.id })
                        }
                      }}
                    >
                      {tabs.find((tab) => tab.id === group.activeTabId)?.customLabel ??
                        tabs.find((tab) => tab.id === group.activeTabId)?.label ??
                        t('paneToolbar.numberedPane', 'Pane {{number}}', { number: i + 1 })}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="pane-title"
                size="icon-xs"
                aria-label={label}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  run()
                }}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        </div>
      ))}
    </div>
  )
}
