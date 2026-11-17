import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { RepositoryIconTabs } from './RepositoryIconTabs'

export const upload = defineFixture({
  width: 440,
  render: () => (
    <RepositoryIconTabs
      initialTab="avatar"
      selectedLucideName={null}
      selectedEmoji=""
      loadingGitHub={false}
      onSetIcon={() => {}}
    />
  )
})
