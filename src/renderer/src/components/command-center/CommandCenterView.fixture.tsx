import logoUrl from '../../../../../resources/build/icon.png?url'
import { useState } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { commandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'
import { CommandCenterView, type CommandCenterTile } from './CommandCenterView'

const sessions: CommandCenterTile[] = Array.from({ length: 6 }, (_, index) => ({
  id: `local/pty-${index}/generation-1`,
  ownerId: 'local',
  route: { target: { kind: 'local' }, at: 'local' },
  previewPtyId: `pty-${index}`,
  available: true,
  repoId: index < 4 ? 'orca' : 'loadmanager',
  hostLabel: 'Local Mac',
  activity: {
    count: 1,
    unread: index === 3,
    state: (['working', 'waiting', 'failed', 'done', 'working', 'permission'] as const)[index],
    progress: index === 4 ? 42 : undefined
  },
  repo: {
    id: index < 4 ? 'orca' : 'loadmanager',
    displayName: index < 4 ? 'Orca' : 'LoadManager',
    path: '/projects',
    badgeColor: '',
    addedAt: 1,
    repoIcon: { type: 'lucide', name: index < 4 ? 'Code2' : 'Package' }
  },
  terminal: {
    handle: `terminal-${index}`,
    ptyId: `pty-${index}`,
    incarnationId: 'generation-1',
    worktreeId: 'workspace-1',
    worktreePath: '/projects/orca',
    branch: 'main',
    tabId: `tab-${index}`,
    leafId: 'leaf',
    title: [
      'Codex · sidebar navigation',
      'Shell · development server',
      'Claude · terminal inventory',
      'Shell · integration checks',
      'Codex · receipts',
      'Shell · API'
    ][index],
    connected: true,
    writable: true,
    lastOutputAt: null,
    preview: ''
  }
}))

function Preview({
  width,
  height,
  empty = false,
  columns = false,
  balanced = false,
  includeChat = false,
  threeColumns = false
}: {
  width: number
  height: number
  empty?: boolean
  columns?: boolean
  balanced?: boolean
  includeChat?: boolean
  threeColumns?: boolean
}) {
  const [presentation, setPresentation] = useState(
    commandCenterPresentation({ layout: columns ? 'auto-columns' : 'auto-grid' })
  )
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    columns && !balanced && !threeColumns
      ? new Set(sessions.slice(0, 2).map((s) => s.id))
      : new Set()
  )
  return (
    <div className="flex" style={{ width, height }}>
      <CommandCenterView
        sessions={
          empty
            ? []
            : threeColumns
              ? [sessions[0], sessions[4], sessions[5]]
              : includeChat
                ? [
                    sessions[0],
                    {
                      kind: 'chat',
                      id: 'local/chat/session',
                      ownerId: 'local',
                      repoId: 'orca',
                      repo: sessions[0].repo,
                      hostLabel: 'Local Mac',
                      available: true,
                      title: 'Review receipts',
                      activity: { count: 1, unread: false, state: 'working' },
                      tab: {
                        id: 'chat',
                        entityId: 'chat-session',
                        worktreeId: 'workspace-1',
                        groupId: 'chat-group',
                        contentType: 'agent-session',
                        agentSessionAgent: 'codex',
                        executionHostId: 'local',
                        label: 'Codex Chat',
                        customLabel: 'Review receipts',
                        color: null,
                        sortOrder: 0,
                        createdAt: 1
                      },
                      chat: {
                        mode: 'structured',
                        tabId: 'chat',
                        sessionId: 'chat-session',
                        target: { kind: 'local' },
                        agent: 'codex',
                        isVisible: true,
                        isFocusedGroup: false
                      }
                    }
                  ]
                : balanced
                  ? [sessions[0], sessions[4]]
                  : sessions
        }
        presentation={presentation}
        onChange={setPresentation}
        onBack={() => {}}
        onRefresh={() => {}}
        refreshing={false}
        onOpen={() => {}}
        onEnd={() => {}}
        collapsed={collapsed}
        onCollapse={(id) =>
          setCollapsed((value) => {
            const next = new Set(value)
            if (next.has(id)) {
              next.delete(id)
            } else {
              next.add(id)
            }
            return next
          })
        }
        renderTerminal={(session) =>
          session.kind === 'chat' ? (
            <div className="min-h-0 flex-1 p-3 text-sm">Chat transcript preview</div>
          ) : (
            <div className="scrollbar-sleek min-h-0 flex-1 overflow-auto bg-background p-3 font-mono text-xs">
              <div className="text-muted-foreground">~/projects/{session.repoId} · main</div>
              <div className="mt-2">$ pnpm tc</div>
              <div className="mt-1">Checking project references…</div>
              <div className="mt-3 text-muted-foreground">Ready for the next command.</div>
              <div className="mt-2">$ ▋</div>
            </div>
          )
        }
      />
    </div>
  )
}

export const desktop = defineFixture({
  width: 1440,
  render: () => <Preview width={1440} height={900} />
})
export const tablet = defineFixture({
  width: 1024,
  render: () => <Preview width={1024} height={768} />
})
export const phone = defineFixture({
  width: 390,
  render: () => <Preview width={390} height={844} />
})
export const empty = defineFixture({
  width: 1024,
  render: () => <Preview width={1024} height={768} empty />
})
export const collapsedColumns = defineFixture({
  width: 1440,
  render: () => <Preview width={1440} height={900} columns />
})

export const balancedColumns = defineFixture({
  width: 1440,
  render: () => <Preview width={1440} height={900} columns balanced />
})

export const twoProjectsShortWindow = defineFixture({
  width: 1180,
  render: () => <Preview width={1180} height={380} balanced />,
  interact: async (frame) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    const tiles = Array.from(
      frame.querySelectorAll<HTMLElement>('section[aria-label] > header')
    ).map((header) => header.parentElement!.getBoundingClientRect())
    const bottom = frame.getBoundingClientRect().bottom
    if (tiles.length !== 2 || tiles.some((tile) => tile.bottom > bottom)) {
      throw new Error('Both project sessions must fit in the automatic grid')
    }
  }
})

export const mixedChatAndTerminal = defineFixture({
  width: 1440,
  render: () => <Preview width={1440} height={900} includeChat />
})

export const threeFullHeightColumns = defineFixture({
  width: 1200,
  render: () => <Preview width={1200} height={900} columns threeColumns />,
  interact: (frame) => {
    const tiles = [...frame.querySelectorAll<HTMLElement>('section[aria-label] > header')].map(
      (header) => header.parentElement!.getBoundingClientRect()
    )
    if (
      tiles.length !== 3 ||
      tiles.some((tile) => tile.height < 800) ||
      tiles.some((tile) => Math.abs(tile.top - tiles[0].top) > 1) ||
      tiles[1].left < tiles[0].right ||
      tiles[2].left < tiles[1].right
    ) {
      throw new Error('Auto Columns must show three separate full-height session columns.')
    }
  }
})

export const projectColorsWithLogos = defineFixture({
  width: 1200,
  render: () => (
    <div className="flex h-[900px] w-[1200px]">
      <CommandCenterView
        sessions={[
          {
            ...sessions[0],
            repo: {
              ...sessions[0].repo!,
              badgeColor: '#ef4444',
              repoIcon: { type: 'image', source: 'upload', src: logoUrl }
            }
          },
          {
            ...sessions[4],
            repo: {
              ...sessions[4].repo!,
              badgeColor: '#14b8a6',
              repoIcon: { type: 'image', source: 'upload', src: logoUrl }
            }
          },
          {
            ...sessions[5],
            repo: undefined,
            projectName: 'Client folders',
            projectColor: '#8b5cf6'
          }
        ]}
        presentation={commandCenterPresentation({ layout: 'auto-columns' })}
        onChange={() => {}}
        onBack={() => {}}
        onRefresh={() => {}}
        refreshing={false}
        onOpen={() => {}}
        onEnd={() => {}}
        collapsed={new Set()}
        onCollapse={() => {}}
        renderTerminal={() => (
          <div className="min-h-0 flex-1 p-3 text-xs text-muted-foreground">Session preview</div>
        )}
      />
    </div>
  )
})
