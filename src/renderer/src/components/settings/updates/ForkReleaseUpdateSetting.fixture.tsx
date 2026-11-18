import { defineFixture } from '../../../component-fixtures/component-fixture'
import { ForkReleaseUpdateSetting } from './ForkReleaseUpdateSetting'
import { SettingsGroup } from '../section-layout/SettingsGroup'

export const available = defineFixture({
  width: 720,
  store: {
    forkReleaseStatus: {
      baseVersion: '1.4.214',
      releaseTag: 'v1.4.215',
      checking: false,
      error: null
    }
  },
  render: () => (
    <div className="settings-view-shell p-8">
      <SettingsGroup title="About">
        <ForkReleaseUpdateSetting />
      </SettingsGroup>
    </div>
  )
})
export const offline = defineFixture({
  width: 720,
  store: {
    forkReleaseStatus: {
      baseVersion: '1.4.214',
      releaseTag: 'v1.4.215',
      checking: false,
      error: 'Unable to check the latest stable upstream release.'
    }
  },
  render: () => (
    <div className="settings-view-shell p-8">
      <SettingsGroup title="About">
        <ForkReleaseUpdateSetting />
      </SettingsGroup>
    </div>
  )
})
