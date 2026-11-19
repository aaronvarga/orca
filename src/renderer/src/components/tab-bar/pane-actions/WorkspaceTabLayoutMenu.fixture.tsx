import type { HostedTerminalQuickCommand } from '@/lib/terminal/quick-commands/use-terminal-quick-command-hosts'
import { TabBarQuickCommandsMenu } from '../quick-commands/TabBarQuickCommandsMenu'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host/execution-host'
import { useAppStore } from '@/store'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { WorkspaceTabLayoutMenu } from './WorkspaceTabLayoutMenu'

const worktreeId = 'layout-fixture'
const noop = () => {}
const recent: HostedTerminalQuickCommand = {
  key: 'handoff',
  hostId: LOCAL_EXECUTION_HOST_ID,
  hostLabel: 'Local',
  command: { id: 'handoff', label: 'CC (Handoff Resume)', command: '', appendEnter: true }
}

const tabs = ['One', 'Two', 'Three', 'Four'].map((label, index) => ({
  id: `tab-${index}`,
  entityId: `tab-${index}`,
  label,
  worktreeId,
  groupId: 'root',
  contentType: 'agent-session' as const,
  customLabel: null,
  color: null,
  sortOrder: index,
  createdAt: 0
}))
export const menu = defineFixture({
  width: 720,
  store: {
    unifiedTabsByWorktree: { [worktreeId]: tabs },
    groupsByWorktree: {
      [worktreeId]: [
        { id: 'root', worktreeId, activeTabId: 'tab-0', tabOrder: tabs.map((tab) => tab.id) }
      ]
    },
    activeGroupIdByWorktree: { [worktreeId]: 'root' },
    layoutByWorktree: { [worktreeId]: { type: 'leaf', groupId: 'root' } }
  },
  render: () => (
    <div
      data-workspace-tab-layout=""
      className="@container/tab-strip flex h-8 items-center justify-end gap-0.5 bg-card text-card-foreground"
    >
      <TabBarQuickCommandsMenu
        isFocused
        repoCommands={[recent]}
        globalCommands={[]}
        mostRecent={recent}
        addHosts={[]}
        hostLoadFailed={false}
        hostOwnershipPending={false}
        onAddCommand={noop}
        onDeleteCommand={noop}
        onEditCommand={noop}
        onMenuOpen={noop}
        onRunCommand={noop}
      />
      <WorkspaceTabLayoutMenu worktreeId={worktreeId} />
    </div>
  ),
  interact: async (frame) => {
    frame.querySelector('[aria-label="Arrange open tabs"]')?.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        ctrlKey: false,
        pointerType: 'mouse'
      })
    )
  }
})

export const arrange = defineFixture({
  ...menu,
  interact: async (frame) => {
    await menu.interact?.(frame)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    document.querySelector<HTMLElement>('[role="menuitemradio"][data-state="checked"]')?.click()
    const state = useAppStore.getState()
    const groups = state.groupsByWorktree[worktreeId]
    if (groups.length !== 4 || groups.some((group) => group.tabOrder.length !== 1)) {
      throw new Error('Auto Grid must arrange all four open tabs, including when already selected')
    }
    if (state.getActiveTab(worktreeId)?.id !== 'tab-0') {
      throw new Error('Arranging tabs must preserve the selected tab')
    }
  }
})

export const toolbar = defineFixture({ ...menu, interact: undefined })
export const narrowToolbar = defineFixture({ ...toolbar, width: 360 })
