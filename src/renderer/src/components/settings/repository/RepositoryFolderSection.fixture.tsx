import { ConfirmationDialogProvider } from '@/components/dismiss/confirmation/confirmation-dialog'
import Settings from '../Settings'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { Repo } from '../../../../../shared/repository/repo-types'
import { RepositoryFolderSection } from './RepositoryFolderSection'
import { SettingsGroup } from '../section-layout/SettingsGroup'

const repo: Repo = {
  id: 'folder-location',
  path: '/Users/demo/Clients/Kelley Supply',
  displayName: 'Kelley Supply',
  kind: 'folder',
  addedAt: 1,
  badgeColor: 'gray'
}
export const folder = defineFixture({
  width: 720,
  store: { repos: [repo], refreshModelStates: async () => {} },
  render: () => (
    <div className="settings-view-shell p-8">
      <SettingsGroup title="Project">
        <RepositoryFolderSection repo={repo} />
      </SettingsGroup>
    </div>
  )
})

export const settingsPage = defineFixture({
  ...folder,
  width: 1200,
  store: { ...folder.store, settingsNavigationTarget: { pane: 'repo', repoId: repo.id } },
  render: () => (
    <div className="h-[800px]">
      <ConfirmationDialogProvider>
        <Settings />
      </ConfirmationDialogProvider>
    </div>
  )
})
