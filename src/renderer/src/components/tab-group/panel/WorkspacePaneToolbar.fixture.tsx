import { useState, type CSSProperties } from 'react'
import { RetainedPaneHost } from '../retained-pane/RetainedPaneHost'
import { tabGroupBodyAnchorName } from '../retained-pane/tab-group-body-anchor'
import { registerTabGroupBody } from '../retained-pane/tab-group-body-geometry'
import { useAppStore } from '@/store'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { WorkspacePaneToolbar } from './WorkspacePaneToolbar'
import { usePanePresentationStyle } from './use-workspace-pane-presentation'

const groups = [
  { id: 'left', worktreeId: 'toolbar-workspace', activeTabId: 'chat', tabOrder: ['chat'] },
  { id: 'right', worktreeId: 'toolbar-workspace', activeTabId: 'terminal', tabOrder: ['terminal'] }
]
function Pane({ groupId, visible }: { groupId: string; visible: boolean }) {
  const { setElement, floating, style } = usePanePresentationStyle(
    'toolbar-workspace',
    groupId,
    visible
  )
  const bodyStyle: CSSProperties & { anchorName: string } = {
    anchorName: tabGroupBodyAnchorName(groupId)
  }
  return (
    <div
      role="region"
      ref={setElement}
      style={style}
      aria-label={`${groupId} pane`}
      data-pane-floating={floating || undefined}
      className={`flex min-h-64 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card text-card-foreground ${floating ? 'rounded-md shadow-floating max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-4rem)]' : ''}`}
    >
      <div className="h-8 shrink-0 border-b border-border px-2 text-sm">{groupId} tab</div>
      <div
        ref={(node) => (node ? registerTabGroupBody(groupId, node) : undefined)}
        className="min-h-0 flex-1"
        style={bodyStyle}
      />
    </div>
  )
}
function Session({ groupId, visible }: { groupId: string; visible: boolean }) {
  return (
    <RetainedPaneHost worktreeId="toolbar-workspace" groupId={groupId} isVisible={visible}>
      <section
        role="region"
        aria-label={`${groupId} session`}
        className="flex min-h-0 flex-1 flex-col bg-card text-card-foreground"
      >
        <header
          className="pane-title-bar flex h-8 shrink-0 justify-end bg-muted"
          data-active-pane
          style={{ position: 'relative' }}
        >
          <WorkspacePaneToolbar
            worktreeId="toolbar-workspace"
            groupId={groupId}
            onClose={() => useAppStore.getState().closeEmptyGroup('toolbar-workspace', groupId)}
          />
        </header>
        <article className="p-4 text-sm">
          {groupId === 'left'
            ? 'Existing chat session'
            : groupId === 'right'
              ? 'Existing terminal session'
              : 'Choose a session'}
        </article>
      </section>
    </RetainedPaneHost>
  )
}
function Panes() {
  const rows = useAppStore((state) => state.groupsByWorktree['toolbar-workspace'])
  const [visible, setVisible] = useState(true)
  return (
    <div className="relative flex h-[640px] flex-col bg-background p-3">
      <button className="mb-2 self-start text-xs" onClick={() => setVisible(!visible)}>
        {visible ? 'Hide workspace' : 'Show workspace'}
      </button>
      <div className="relative min-h-0 flex-1" style={{ display: visible ? 'flex' : 'none' }}>
        <div className="flex min-h-0 flex-1 gap-3">
          {rows.map((group) => (
            <Pane key={group.id} groupId={group.id} visible={visible} />
          ))}
        </div>
        {rows.map((group) => (
          <Session key={group.id} groupId={group.id} visible={visible} />
        ))}
      </div>
    </div>
  )
}
export const desktop = defineFixture({
  width: 1200,
  store: {
    groupsByWorktree: { 'toolbar-workspace': groups },
    activeGroupIdByWorktree: { 'toolbar-workspace': 'left' },
    layoutByWorktree: {
      'toolbar-workspace': {
        type: 'split',
        direction: 'horizontal',
        first: { type: 'leaf', groupId: 'left' },
        second: { type: 'leaf', groupId: 'right' },
        ratio: 0.7
      }
    },
    unifiedTabsByWorktree: {
      'toolbar-workspace': [
        {
          id: 'chat',
          entityId: 'chat-session',
          groupId: 'left',
          worktreeId: 'toolbar-workspace',
          contentType: 'agent-session',
          agentSessionAgent: 'codex',
          label: 'Codex Chat',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        },
        {
          id: 'terminal',
          entityId: 'terminal-session',
          groupId: 'right',
          worktreeId: 'toolbar-workspace',
          contentType: 'terminal',
          label: 'Terminal',
          customLabel: null,
          color: null,
          sortOrder: 1,
          createdAt: 1
        }
      ]
    }
  },
  render: () => <Panes />
})

export const floating = defineFixture({
  ...desktop,
  interact: async (frame) => {
    const session = frame.querySelector<HTMLElement>('[aria-label="left session"]')
    const pane = frame.querySelector<HTMLElement>('[aria-label="left pane"]')
    const float = session?.querySelector<HTMLButtonElement>('[aria-label="Float Pane"]')
    if (!session || !pane || !float) {
      throw new Error('Floating pane fixture did not mount')
    }
    float.click()
    const settle = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
    await settle()
    const before = pane.getBoundingClientRect()
    const toggle = frame.querySelector<HTMLButtonElement>('button')
    toggle?.click()
    await settle()
    toggle?.click()
    await settle()
    const after = pane.getBoundingClientRect()
    const rect = session.getBoundingClientRect()
    if (
      Math.abs(before.width - after.width) > 1 ||
      Math.abs(before.height - after.height) > 1 ||
      !session.contains(
        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
      )
    ) {
      throw new Error('Floating session disappeared after hiding its workspace')
    }
  }
})
