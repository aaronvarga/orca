import { useAppStore } from '@/store'
import { stubBots } from '../../../../component-fixtures/fixture-bots'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { NativeChatPaneHeader } from '../actions/NativeChatPaneHeader'
import { RetainedPaneHost } from '@/components/tab-group/retained-pane/RetainedPaneHost'
import { PromptBar } from '../../beautiful-ui/PromptBar'
import { NativeChatTabSplitLayout } from './NativeChatTabSplitLayout'
import { nativeChatPaneAnchorId } from '../../../../../../shared/native-chat/layout/native-chat-tab-splits'
import type {
  Tab,
  TabGroupLayoutNode
} from '../../../../../../shared/workspace-layout/tab-groups/tab-types'

const worktreeId = 'folder:split-fixture'
const ids = ['chat-a', 'chat-b', 'chat-c']
const tabs: Tab[] = ids.map((id, index) => ({
  id,
  entityId: `session-${id}`,
  contentType: 'agent-session',
  agentSessionAgent: 'codex',
  executionHostId: 'local',
  groupId: 'group',
  worktreeId,
  label: 'Codex Chat',
  customLabel: null,
  color: null,
  createdAt: 1,
  sortOrder: index
}))
const layout: TabGroupLayoutNode = {
  type: 'split',
  direction: 'horizontal',
  ratio: 0.5,
  first: { type: 'leaf', groupId: 'chat-a' },
  second: {
    type: 'split',
    direction: 'vertical',
    ratio: 0.5,
    first: { type: 'leaf', groupId: 'chat-b' },
    second: { type: 'leaf', groupId: 'chat-c' }
  }
}

function SplitChatFixture() {
  const selected = useAppStore((state) => state.groupsByWorktree[worktreeId][0].activeTabId)
  const root = useAppStore((state) => state.nativeChatTabSplits!['chat-a'].layout)
  return (
    <div className="relative flex flex-col h-[640px] bg-background text-foreground">
      <div className="flex h-8 shrink-0 border-b border-border bg-tab-bar">
        <div role="tab" aria-selected="true" className="flex items-center bg-accent px-3 text-sm">
          Project conversation
        </div>
      </div>
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <NativeChatTabSplitLayout worktreeId={worktreeId} splitKey="chat-a" layout={root} />
      </div>
      {ids.map((id, index) => (
        <RetainedPaneHost
          key={id}
          worktreeId={worktreeId}
          groupId="group"
          anchorId={nativeChatPaneAnchorId(id)}
          isVisible
          onFocusOwningGroup={() => useAppStore.getState().activateTab(id, { worktreeId })}
        >
          <div className="native-chat-appearance flex flex-col h-full w-full bg-chat-canvas">
            <NativeChatPaneHeader
              tabId={id}
              groupId="group"
              worktreeId={worktreeId}
              nativeChat={{ sessionId: `session-${id}`, agent: 'codex' }}
              focused={selected === id}
              colorScheme={undefined}
            />
            <div className="flex-1 p-4 text-sm text-chat-foreground">
              Independent conversation {index + 1}
            </div>
            <div className="p-3">
              <PromptBar expanded={false} launch={false}>
                <textarea
                  aria-label={`Message conversation ${index + 1}`}
                  className="min-h-16 w-full resize-none bg-transparent p-2 text-sm text-foreground outline-none"
                />
              </PromptBar>
            </div>
          </div>
        </RetainedPaneHost>
      ))}
    </div>
  )
}

export const desktop = defineFixture({
  width: 1200,
  setup: () => stubBots([]),
  store: {
    activeWorktreeId: worktreeId,
    nativeChatTabSplits: { 'chat-a': { executionHostId: 'local', layout } },
    unifiedTabsByWorktree: { [worktreeId]: tabs },
    groupsByWorktree: {
      [worktreeId]: [{ id: 'group', worktreeId, activeTabId: 'chat-b', tabOrder: ids }]
    },
    activeGroupIdByWorktree: { [worktreeId]: 'group' }
  },
  render: () => <SplitChatFixture />,
  interact: (frame) => {
    const panes = [...frame.querySelectorAll<HTMLElement>('[data-chat-split-tab-id]')].map((pane) =>
      pane.getBoundingClientRect()
    )
    const hosts = [...frame.querySelectorAll<HTMLElement>('[data-retained-pane-host]')].map(
      (pane) => pane.getBoundingClientRect()
    )
    if (
      hosts.length !== 3 ||
      hosts.some((pane) => pane.width < 100 || pane.height < 100) ||
      panes.length !== 3 ||
      panes.some((pane) => pane.width < 100 || pane.height < 100) ||
      panes[1].left < panes[0].right ||
      panes[2].top < panes[1].bottom
    ) {
      throw new Error('The three chat panes must occupy separate, visible regions inside one tab')
    }
  }
})
export const narrow = defineFixture({ ...desktop, width: 640 })

export const equalizedColumns = defineFixture({
  ...desktop,
  store: {
    ...desktop.store,
    nativeChatTabSplits: {
      'chat-a': {
        executionHostId: 'local',
        layout: {
          ...layout,
          ratio: 0.8,
          second: {
            type: 'split',
            direction: 'horizontal',
            ratio: 0.7,
            first: { type: 'leaf', groupId: 'chat-b' },
            second: { type: 'leaf', groupId: 'chat-c' }
          }
        }
      }
    }
  },
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('button[aria-label="Equalize Splits"]')!.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const widths = [...frame.querySelectorAll<HTMLElement>('[data-chat-split-tab-id]')].map(
      (pane) => pane.getBoundingClientRect().width
    )
    if (
      widths.length !== 3 ||
      Math.min(...widths) < 100 ||
      Math.max(...widths) - Math.min(...widths) > 3
    ) {
      throw new Error('Equalize must give all three adjacent chat sessions the same width')
    }
  }
})
