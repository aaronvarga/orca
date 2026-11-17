import { CommandCenterViewMenu } from './CommandCenterViewMenu'
// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { CommandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'
import { CommandCenterView, type CommandCenterTile } from './CommandCenterView'

vi.mock('@/i18n/use-translate', () => ({
  useTranslate: () => (_key: string, fallback: string) => fallback
}))
vi.mock('@/components/repo/repo-icon', () => ({ RepoIconGlyph: () => null }))

const first: CommandCenterTile = {
  id: 'local/pty-one/process-one',
  ownerId: 'local',
  route: { target: { kind: 'local' }, at: 'local' },
  previewPtyId: 'pty-one',
  available: true,
  repoId: 'project-one',
  hostLabel: 'This computer',
  terminal: {
    handle: 'handle-one',
    ptyId: 'pty-one',
    incarnationId: 'process-one',
    worktreeId: 'workspace-one',
    worktreePath: '/project-one',
    branch: 'main',
    tabId: 'tab-one',
    leafId: 'leaf-one',
    title: 'First shell',
    connected: true,
    writable: true,
    lastOutputAt: null,
    preview: ''
  }
}
const second: CommandCenterTile = {
  ...first,
  id: 'local/pty-two/process-two',
  previewPtyId: 'pty-two',
  repoId: 'project-two',
  terminal: {
    ...first.terminal,
    handle: 'handle-two',
    ptyId: 'pty-two',
    incarnationId: 'process-two',
    title: 'Second shell'
  }
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true }])
      }
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harness({
  sessions,
  running,
  ended
}: {
  sessions: CommandCenterTile[]
  running: Set<string>
  ended: string[]
}) {
  const [presentation, setPresentation] = useState<CommandCenterPresentation>({
    layout: 'manual',
    columns: 1,
    rows: 2,
    groupByProject: false,
    project: 'all',
    host: 'all',
    order: [],
    hidden: []
  })
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [left, setLeft] = useState(false)
  if (left) {
    return <output aria-label="destination">projects</output>
  }
  return (
    <TooltipProvider>
      <CommandCenterView
        sessions={sessions}
        presentation={presentation}
        onChange={setPresentation}
        refreshing={false}
        onBack={() => setLeft(true)}
        onRefresh={() => {}}
        onOpen={() => setLeft(true)}
        onEnd={(session) => {
          running.delete(session.id)
          ended.push(session.id)
        }}
        collapsed={collapsed}
        onCollapse={(id) =>
          setCollapsed((prior) => {
            const next = new Set(prior)
            if (next.has(id)) {
              next.delete(id)
            } else {
              next.add(id)
            }
            return next
          })
        }
        renderTerminal={(session) => <output aria-label="live terminal">{session.id}</output>}
      />
    </TooltipProvider>
  )
}

function tile(title: string) {
  return screen.getByRole('region', { name: new RegExp(title) })
}
async function menu(user: ReturnType<typeof userEvent.setup>, title: string, action: string) {
  await user.click(within(tile(title)).getByRole('button', { name: 'Session actions' }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

it('collapse, filtering, hiding, and leaving preserve the running processes', async () => {
  const user = userEvent.setup()
  const running = new Set(['local/pty-one/process-one', 'local/pty-two/process-two'])
  const ended: string[] = []
  render(<Harness sessions={[first, second]} running={running} ended={ended} />)
  await user.click(within(tile('First shell')).getByRole('button', { name: 'Collapse terminal' }))
  expect(within(tile('First shell')).queryByRole('status', { name: 'live terminal' })).toBeNull()
  await user.click(within(tile('First shell')).getByRole('button', { name: 'Expand terminal' }))
  await user.click(screen.getByRole('button', { name: 'View options' }))
  await user.click(screen.getByRole('menuitemradio', { name: 'project-two' }))
  expect(screen.queryByRole('region', { name: /First shell/ })).toBeNull()
  await menu(user, 'Second shell', 'Hide Session')
  expect(screen.queryByRole('region', { name: /Second shell/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect([...running]).toEqual(['local/pty-one/process-one', 'local/pty-two/process-two'])
  expect(ended).toEqual([])
})

it('opening a session in its project preserves every running process', async () => {
  const user = userEvent.setup()
  const running = new Set(['local/pty-one/process-one', 'local/pty-two/process-two'])
  const ended: string[] = []
  render(<Harness sessions={[first, second]} running={running} ended={ended} />)
  await menu(user, 'Second shell', 'Open in Project')
  expect(screen.getByRole('status', { name: 'destination' })).toBeInTheDocument()
  expect([...running]).toEqual(['local/pty-one/process-one', 'local/pty-two/process-two'])
  expect(ended).toEqual([])
})

it('End Session selects only the terminal whose menu was activated', async () => {
  const user = userEvent.setup()
  const running = new Set(['local/pty-one/process-one', 'local/pty-two/process-two'])
  const ended: string[] = []
  render(<Harness sessions={[first, second]} running={running} ended={ended} />)
  await menu(user, 'Second shell', 'End Session')
  expect(ended).toEqual(['local/pty-two/process-two'])
  expect([...running]).toEqual(['local/pty-one/process-one'])
})

it('keyboard reordering changes presentation order while hidden choices stay with their process incarnation', async () => {
  const user = userEvent.setup()
  const running = new Set(['local/pty-one/process-one', 'local/pty-two/process-two'])
  const ended: string[] = []
  const view = render(<Harness sessions={[first, second]} running={running} ended={ended} />)
  await user.click(within(tile('Second shell')).getByRole('button', { name: 'Session actions' }))
  const moveEarlier = await screen.findByRole('menuitem', { name: 'Move Earlier' })
  moveEarlier.focus()
  await user.keyboard('{Enter}')
  expect(
    screen.getAllByRole('status', { name: 'live terminal' }).map((el) => el.textContent)
  ).toEqual(['local/pty-two/process-two', 'local/pty-one/process-one'])
  await menu(user, 'First shell', 'Hide Session')
  const replacement: CommandCenterTile = {
    ...first,
    id: 'local/pty-one/process-replacement',
    terminal: {
      ...first.terminal,
      incarnationId: 'process-replacement',
      title: 'Replacement shell'
    }
  }
  view.rerender(<Harness sessions={[replacement, second]} running={running} ended={ended} />)
  expect(
    within(tile('Replacement shell')).getByRole('status', { name: 'live terminal' })
  ).toHaveTextContent('local/pty-one/process-replacement')
  expect(ended).toEqual([])
})

it('layout menu applies presets and keyboard-selected custom dimensions without changing filters', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn<(value: CommandCenterPresentation) => void>()
  render(
    <CommandCenterViewMenu
      presentation={{
        layout: 'auto-grid',
        columns: 2,
        rows: 2,
        groupByProject: true,
        project: 'project-one',
        host: 'local',
        order: [],
        hidden: []
      }}
      onChange={onChange}
      projects={[]}
      hosts={[]}
      showHidden={false}
      onShowHiddenChange={() => {}}
    />
  )
  await user.click(screen.getByRole('button', { name: 'View options' }))
  await user.click(screen.getByRole('menuitemradio', { name: '3 × 2' }))
  expect(onChange).toHaveBeenLastCalledWith({
    layout: 'manual',
    columns: 3,
    rows: 2,
    groupByProject: true,
    project: 'project-one',
    host: 'local',
    order: [],
    hidden: []
  })
  await user.click(screen.getByRole('button', { name: 'View options' }))
  await user.click(screen.getByRole('menuitem', { name: 'Custom layout…' }))
  const largest = await screen.findByRole('menuitem', { name: '10 × 8' })
  largest.focus()
  await user.keyboard('{Enter}')
  expect(onChange).toHaveBeenLastCalledWith({
    layout: 'manual',
    columns: 10,
    rows: 8,
    groupByProject: true,
    project: 'project-one',
    host: 'local',
    order: [],
    hidden: []
  })
})

it('includes chats beside terminals and opens the selected chat in its project', async () => {
  const user = userEvent.setup()
  const chat: CommandCenterTile = {
    kind: 'chat',
    id: 'local/chat/session',
    ownerId: 'local',
    repoId: 'project-one',
    projectName: 'Project One',
    hostLabel: 'This computer',
    available: true,
    title: 'Review receipts',
    tab: {
      id: 'chat-tab',
      entityId: 'chat-session',
      groupId: 'chat-group',
      worktreeId: 'workspace-one',
      executionHostId: 'local',
      contentType: 'agent-session',
      agentSessionAgent: 'codex',
      label: 'Codex Chat',
      customLabel: null,
      color: null,
      sortOrder: 0,
      createdAt: 1
    },
    chat: {
      mode: 'structured',
      tabId: 'chat-tab',
      sessionId: 'chat-session',
      target: { kind: 'local' },
      agent: 'codex',
      isVisible: true,
      isFocusedGroup: false
    }
  }
  render(<Harness sessions={[first, chat]} running={new Set()} ended={[]} />)
  expect(
    screen.getAllByRole('status', { name: 'live terminal' }).map((el) => el.textContent)
  ).toEqual(['local/pty-one/process-one', 'local/chat/session'])
  await menu(user, 'Review receipts', 'Open in Project')
  expect(screen.getByRole('status', { name: 'destination' })).toBeInTheDocument()
})
