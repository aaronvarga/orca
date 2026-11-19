import { create } from 'zustand'
import { expectMovedTabSelection } from '@/runtime/workspace-layout/intents/layout-owner-pane-intents'
import { tabSelectionKey } from '@/store/slices/tabs/moved-tab-selection'
import { layoutFramesFlowing } from '@/runtime/workspace-layout/frames/layout-frame-position'
import { arrangeWorkspaceTabsLocally } from './arrange-workspace-tabs-locally'
import { useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, Grid2X2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { TabLayoutMenuItems, type TabLayout } from '@/components/command-center/TabLayoutMenuItems'
import { commandCenterColumns } from '@/components/command-center/command-center-layout'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../../shared/workspace-layout/layout-owner-switch'
import { sendLayoutCommandToOwner } from '@/runtime/workspace-layout/commands/layout-owner-command'
import { runtimeEnvironmentIdUnlessTwin } from '@/lib/workspace/ownership/resolve-owner'

const TRIGGER_STYLE: CSSProperties & { WebkitAppRegion: 'no-drag' } = { WebkitAppRegion: 'no-drag' }
const DEFAULT_LAYOUT: TabLayout = { layout: 'auto-grid', columns: 2, rows: 2 }
const useTabLayouts = create<{ layouts: Record<string, TabLayout> }>(() => ({ layouts: {} }))

export function WorkspaceTabLayoutMenu({ worktreeId }: { worktreeId: string }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const t = useTranslate()
  const value = useTabLayouts((state) => state.layouts[worktreeId] ?? DEFAULT_LAYOUT)
  const setValue = (next: TabLayout) =>
    useTabLayouts.setState((state) => ({
      layouts: { ...state.layouts, [worktreeId]: next }
    }))
  const [pending, setPending] = useState(false)
  const count = useAppStore((state) => state.unifiedTabsByWorktree[worktreeId]?.length ?? 0)
  const label = t('workspaceTabs.arrange', 'Arrange open tabs')
  const failed = () => {
    setPending(false)
    toast.error(t('workspaceTabs.arrangeFailed', 'Could not arrange open tabs on this host.'))
  }
  const layoutLabel =
    value.layout === 'auto-grid'
      ? t('commandCenter.autoGrid', 'Auto Grid')
      : value.layout === 'auto-columns'
        ? t('commandCenter.autoColumns', 'Auto Columns')
        : `${value.columns} × ${value.rows}`
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="outline"
          size="inline"
          className="my-auto h-7 shrink-0 @max-[163px]/tab-strip:hidden overflow-hidden"
          aria-label={label}
          disabled={count === 0 || pending}
          style={TRIGGER_STYLE}
        >
          <span className="flex items-center gap-1.5 px-1.5">
            <Grid2X2 className="size-3 shrink-0" />
            <span className="@max-[480px]/tab-strip:hidden">{layoutLabel}</span>
          </span>
          <span className="flex h-full items-center border-l border-border/60 px-1">
            <ChevronDown className="size-3" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <TabLayoutMenuItems
          value={value}
          onChange={(next) => {
            const state = useAppStore.getState()
            const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
            const width =
              trigger.current?.closest('[data-workspace-tab-layout]')?.getBoundingClientRect()
                .width ?? window.innerWidth
            const columns = commandCenterColumns(next, tabs.length, width)
            const rows = next.layout === 'manual' ? next.rows : Math.ceil(tabs.length / columns)
            const applyLocally = () => {
              if (!arrangeWorkspaceTabsLocally(worktreeId, columns, rows)) {
                failed()
                return
              }
              setPending(false)
              setValue(next)
            }
            if (!ORCA_LAYOUT_OWNER_IS_MAIN && !runtimeEnvironmentIdUnlessTwin(state, worktreeId)) {
              applyLocally()
              return
            }
            const activeGroup = state.groupsByWorktree[worktreeId]?.find(
              (group) => group.id === state.activeGroupIdByWorktree[worktreeId]
            )
            const forget = activeGroup?.activeTabId
              ? expectMovedTabSelection({
                  worktreeId,
                  tabId: activeGroup.activeTabId,
                  fromGroupId: activeGroup.id,
                  selection: tabSelectionKey(state, worktreeId)
                })
              : () => {}
            const refused = () => {
              forget()
              failed()
            }
            setPending(true)
            if (
              !sendLayoutCommandToOwner(
                worktreeId,
                { type: 'arrangeTabs', columns, rows },
                {
                  apply: (_result, origin) => {
                    if (layoutFramesFlowing(origin.framesKey)) {
                      forget()
                    }
                    setPending(false)
                    setValue(next)
                  },
                  asToday: refused,
                  refused
                }
              )
            ) {
              refused()
            }
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
