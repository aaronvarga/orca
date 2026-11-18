import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { NativeChatComposerActions } from './NativeChatComposerActions'

const worktreeId = 'composer-project::/projects/composer'
function composerFixture(
  agent: string,
  width = 640,
  menu = false,
  terminal = false,
  insert = false
) {
  let insertedText: string | null = null
  return defineFixture({
    width,
    store: {
      repos: [
        {
          id: 'composer-project',
          path: '/projects/composer',
          displayName: 'Composer',
          badgeColor: '',
          addedAt: 1
        }
      ],
      activeWorktreeId: 'other-project::/projects/other',
      tabsByWorktree: terminal
        ? {
            [worktreeId]: [
              {
                id: 'composer-chat',
                ptyId: 'pty',
                worktreeId,
                title: 'Chat',
                customTitle: null,
                color: null,
                sortOrder: 0,
                createdAt: 1
              }
            ]
          }
        : {},
      unifiedTabsByWorktree: {
        [worktreeId]: [
          {
            id: terminal ? 'terminal-wrapper' : 'composer-chat',
            entityId: terminal ? 'composer-chat' : 'session',
            contentType: terminal ? 'terminal' : 'agent-session',
            agentSessionAgent: 'codex',
            worktreeId,
            groupId: 'composer-pane',
            label: 'Chat',
            customLabel: null,
            color: null,
            sortOrder: 0,
            createdAt: 1
          }
        ]
      }
    },
    setup: () =>
      useAppStore.setState((state) => ({
        settings: {
          ...getDefaultSettings('/home/fixture'),
          ...state.settings,
          terminalQuickCommands: [
            {
              id: 'build',
              label: 'Build this project',
              command: 'pnpm build',
              appendEnter: true,
              scope: { type: 'repo', repoId: 'composer-project' }
            },
            {
              id: 'other',
              label: 'Other project command',
              command: 'pnpm test',
              appendEnter: true,
              scope: { type: 'repo', repoId: 'other-project' }
            }
          ]
        }
      })),
    render: () => (
      <div className="native-chat-appearance bg-background p-3">
        <div className="rounded-xl border border-border p-3">
          <div className="min-h-12 text-sm text-chat-foreground-faint">Ask anything</div>
          <NativeChatComposerActions
            terminalTabId="composer-chat"
            onInsertQuickCommand={(text) => {
              insertedText = text
            }}
            agent={agent}
            attachDisabled={false}
            dictationDisabled={false}
            sendDisabled={false}
            isWorking={false}
            isDictating={false}
            isDictationHoldMode={false}
            onAttach={() => {}}
            onDictationToggle={() => {}}
            onDictationHoldStart={() => {}}
            onDictationHoldEnd={() => {}}
            onSend={() => {}}
            sessionOptionsSurface={{
              getSnapshot: () => [],
              subscribe: () => () => {},
              setOption: async () => ({ snapshot: [] }),
              invokeAction: async () => ({ snapshot: [] })
            }}
            sessionOptionsSnapshot={[
              {
                id: 'model',
                label: 'Model',
                category: 'model',
                transport: 'agent-session',
                settable: true,
                valueSource: 'applied',
                kind: {
                  type: 'select',
                  currentValue: 'model',
                  choices: [
                    {
                      value: 'model',
                      label:
                        agent === 'claude'
                          ? 'Claude Opus 5.5'
                          : agent === 'codex'
                            ? 'GPT-5.5'
                            : 'Claude Sonnet 4.6'
                    }
                  ]
                }
              }
            ]}
          />
        </div>
      </div>
    ),
    interact: menu
      ? async (frame) => {
          const button = frame.querySelector<HTMLButtonElement>('[aria-label="Quick Commands"]')
          if (!button) {
            throw new Error('The composer must expose its quick commands')
          }
          button.dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })
          )
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          const items = Array.from(frame.ownerDocument.querySelectorAll('[role="menuitem"]'))
          if (
            !items.some((item) => item.textContent === 'Build this project') ||
            items.some((item) => item.textContent === 'Other project command')
          ) {
            throw new Error(
              'Quick commands must belong to the composer workspace, not the active workspace'
            )
          }
          if (insert) {
            const tabs = useAppStore.getState().unifiedTabsByWorktree
            const command = items.find((item) => item.textContent === 'Build this project')
            if (!(command instanceof HTMLElement)) {
              throw new Error('Expected the saved project command')
            }
            command.click()
            if (
              insertedText !== 'pnpm build' ||
              useAppStore.getState().unifiedTabsByWorktree !== tabs
            ) {
              throw new Error('Composer commands must insert their text without opening a session')
            }
          }
        }
      : undefined
  })
}

export const claude = composerFixture('claude')
export const codex = composerFixture('codex')
export const copilot = composerFixture('copilot')
export const narrow = composerFixture('claude', 280)
export const quickCommands = composerFixture('codex', 480, true)

export const terminalQuickCommands = composerFixture('claude', 480, true, true)

export const insertCommand = composerFixture('codex', 480, true, false, true)
