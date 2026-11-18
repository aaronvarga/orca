// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { runQuickCommand } from './run-quick-command'

const boundary = vi.hoisted(() => {
  const root: { value: HTMLElement | null } = { value: null }
  return {
    launch: vi.fn(),
    insert: vi.fn(),
    error: vi.fn(),
    root,
    state: {
      activeGroupIdByWorktree: { workspace: 'group' },
      groupsByWorktree: { workspace: [{ id: 'group', activeTabId: 'chat' }] },
      unifiedTabsByWorktree: {
        workspace: [{ id: 'chat', entityId: 'codex-session', contentType: 'agent-session' }]
      },
      setRecentQuickCommandForGroup: vi.fn()
    }
  }
})
vi.mock('./run-quick-command-in-new-tab', () => ({ runQuickCommandInNewTab: boundary.launch }))
vi.mock('@/store/index', () => ({ useAppStore: { getState: () => boundary.state } }))
vi.mock('sonner', () => ({ toast: { error: boundary.error } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, text: string) => text }))
vi.mock('@/components/native-chat/composer/focus/native-chat-composer-focus-intent', () => ({
  nativeChatComposerRootForTab: () => boundary.root.value,
  requestNativeChatComposerFocus: vi.fn()
}))
vi.mock('@/components/native-chat/composer/focus/native-chat-composer-destination', () => ({
  nativeChatComposerDestination: () => ({ insertTypedText: boundary.insert })
}))

beforeEach(() => {
  vi.clearAllMocks()
  boundary.root.value = document.createElement('div')
  boundary.insert.mockReturnValue(true)
  boundary.state.unifiedTabsByWorktree.workspace = [
    { id: 'chat', entityId: 'codex-session', contentType: 'agent-session' }
  ]
})

it('inserts a current-session prompt into Codex without launching the saved fallback agent', () => {
  runQuickCommand({
    worktreeId: 'workspace',
    groupId: 'group',
    command: {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review the current workspace',
      newSession: false
    }
  })
  expect(boundary.insert).toHaveBeenCalledWith('Review the current workspace')
  expect(boundary.launch).not.toHaveBeenCalled()
})

it('opens a new session only when requested', () => {
  runQuickCommand({
    worktreeId: 'workspace',
    groupId: 'group',
    command: {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review the current workspace',
      newSession: true
    }
  })
  expect(boundary.launch).toHaveBeenCalledWith({
    worktreeId: 'workspace',
    groupId: 'group',
    command: {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review the current workspace',
      newSession: true
    }
  })
  expect(boundary.insert).not.toHaveBeenCalled()
})

it('refuses an unavailable current chat without changing the launch target', () => {
  boundary.root.value = null
  runQuickCommand({
    worktreeId: 'workspace',
    command: {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review the current workspace',
      newSession: false
    }
  })
  expect(boundary.error).toHaveBeenCalledWith(
    'Open a session that accepts input to insert this quick command.'
  )
  expect(boundary.launch).not.toHaveBeenCalled()
})

it('pastes a current terminal command without appending Enter', () => {
  boundary.root.value = null
  boundary.state.unifiedTabsByWorktree.workspace = [
    { id: 'chat', entityId: 'terminal-tab', contentType: 'terminal' }
  ]
  let inserted: string | undefined
  const onPaste = (event: Event) => {
    event.preventDefault()
    if (!(event instanceof CustomEvent)) {
      throw new Error('Expected paste request')
    }
    inserted = event.detail.text
    event.detail.onResult(true)
  }
  window.addEventListener('orca-paste-terminal-text', onPaste)
  try {
    runQuickCommand({
      worktreeId: 'workspace',
      paneId: 7,
      command: {
        id: 'shell',
        label: 'Shell',
        command: 'echo inspect',
        appendEnter: true,
        newSession: false
      }
    })
    expect(inserted).toBe('echo inspect')
    expect(boundary.launch).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('orca-paste-terminal-text', onPaste)
  }
})
