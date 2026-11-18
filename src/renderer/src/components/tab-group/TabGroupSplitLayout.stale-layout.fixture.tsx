// A workspace whose last tab closed under another owner can keep a layout that names a group that
// no longer exists. The next tab creates a fresh group: this renders what the workspace then shows.
// Before the fix the layout still named the vanished group, so the strip and pane were empty.
import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store/index'
import { ConfirmationDialogProvider } from '../dismiss/confirmation/confirmation-dialog'
import TabGroupSplitLayout from './TabGroupSplitLayout'
import { RightSidebarToggle } from '@/app-shell/chrome/TitlebarMainStrip'

const WT = 'preview-repo::/preview/repo/feature'
const GONE_GROUP = 'group-that-no-longer-exists'

function Workspace(): React.JSX.Element {
  const layout = useAppStore((state) => state.layoutByWorktree[WT])
  return (
    <ConfirmationDialogProvider>
      <div className="relative flex h-[320px] border border-border bg-background">
        {layout ? <TabGroupSplitLayout layout={layout} worktreeId={WT} isWorktreeActive /> : null}
        <div className="absolute right-0 top-0 flex h-9 items-center">
          <RightSidebarToggle />
        </div>
      </div>
    </ConfirmationDialogProvider>
  )
}

export const newTabAfterStaleLayout = defineFixture({
  width: 640,
  store: {
    repos: [
      { id: 'preview-repo', path: '/preview/repo', displayName: 'repo', badgeColor: '', addedAt: 1 }
    ],
    worktreesByRepo: {
      'preview-repo': [
        {
          id: WT,
          repoId: 'preview-repo',
          path: '/preview/repo/feature',
          displayName: 'feature',
          branch: 'feature',
          head: 'abc123',
          isBare: false,
          isMainWorktree: false,
          comment: '',
          linkedIssue: null,
          linkedPR: null,
          linkedLinearIssue: null,
          isArchived: false,
          isUnread: false,
          isPinned: false,
          sortOrder: 0,
          lastActivityAt: 1
        }
      ]
    },
    activeWorktreeId: WT,
    unifiedTabsByWorktree: { [WT]: [] },
    groupsByWorktree: {},
    layoutByWorktree: { [WT]: { type: 'leaf', groupId: GONE_GROUP } },
    activeGroupIdByWorktree: { [WT]: GONE_GROUP }
  },
  setup: () => {
    // The user opens a new tab in the workspace (an editor tab keeps the pane simple).
    useAppStore.getState().createUnifiedTab(WT, 'editor', { label: 'Notes' })
  },
  render: () => <Workspace />
})

export const headerAlignment = defineFixture({
  ...newTabAfterStaleLayout,
  interact: (frame) => {
    const command = frame
      .querySelector('[aria-label="Add quick command"] svg')
      ?.getBoundingClientRect()
    const pane = frame
      .querySelector('[aria-label="Toggle right sidebar"] svg')
      ?.getBoundingClientRect()
    if (
      !command ||
      !pane ||
      Math.abs(command.y + command.height / 2 - pane.y - pane.height / 2) > 0.1
    ) {
      throw new Error('Command and pane icons must have the same vertical center')
    }
  }
})
