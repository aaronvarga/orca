import { useState } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { TerminalPaneComposer } from './TerminalPaneComposer'

function ComposerExample() {
  const [lastSend, setLastSend] = useState('')
  return (
    <div className="flex h-80 flex-col bg-background text-foreground">
      <pre className="min-h-0 flex-1 overflow-auto scrollbar-sleek p-3 text-xs">
        {lastSend || '$ Terminal output stays above the composer'}
      </pre>
      <TerminalPaneComposer
        target={{ worktreeId: 'fixture::/projects/fixture', executionHostId: 'local' }}
        sessionKey="fixture-composer"
        onFocusTerminal={() => {}}
        onSend={async (text, submit) => {
          setLastSend(`${submit ? 'Sent' : 'Inserted'}: ${text}`)
          return submit ? 'sent' : 'inserted'
        }}
      />
    </div>
  )
}
export const desktop = defineFixture({
  width: 640,
  setup: () => {
    window.api.ui.readClipboardText = async () => ''
    window.api.ui.readClipboardFilePaths = async () => []
    window.api.ui.clipboardHasImage = async () => true
    window.api.ui.saveClipboardImageAsTempFile = async () => '/tmp/Pasted.png'
    window.api.shell.pickAttachments = async () => ['/tmp/diagram.png']
    window.api.shell.captureScreenshot = async () => '/tmp/Screenshot.png'
    window.api.fs.resolveDroppedPathsForAgent = async (args) => {
      const { paths } = structuredClone(args)
      return { resolvedPaths: paths, failed: [], skipped: [] }
    }
  },
  store: {
    repos: [
      {
        id: 'fixture',
        displayName: 'Fixture',
        path: '/projects/fixture',
        badgeColor: '',
        addedAt: 1
      }
    ],
    worktreesByRepo: {
      fixture: [
        {
          id: 'fixture::/projects/fixture',
          repoId: 'fixture',
          path: '/projects/fixture',
          branch: 'main',
          displayName: 'main',
          comment: '',
          linkedIssue: null,
          linkedPR: null,
          linkedLinearIssue: null,
          isUnread: false,
          isPinned: false,
          sortOrder: 0,
          lastActivityAt: 1,
          head: 'abc',
          isBare: false,
          isMainWorktree: true,
          isArchived: false,
          hostId: 'local'
        }
      ]
    }
  },
  render: () => <ComposerExample />
})
export const narrow = defineFixture({ width: 280, render: () => <ComposerExample /> })
