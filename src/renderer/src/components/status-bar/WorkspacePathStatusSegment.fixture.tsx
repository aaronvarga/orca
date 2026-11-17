import { defineFixture } from '../../component-fixtures/component-fixture'
import { StatusBarSurface } from './StatusBarSurface'

const store = {
  activeRepoId: 'orca',
  activeWorkspaceExecutionHostId: 'local' as const,
  activeView: 'terminal' as const,
  statusBarVisible: true,
  usageEmptyStateDismissed: true,
  statusBarItems: [],
  repos: [
    {
      id: 'orca',
      displayName: 'Orca',
      path: '/Users/aaron/Dev/GitHub Repos/orca',
      badgeColor: '',
      addedAt: 1
    }
  ]
}
export const footer = defineFixture({
  width: 900,
  store,
  render: () => <StatusBarSurface floatingTerminalOpen={false} />
})
export const narrow = defineFixture({
  width: 390,
  store,
  render: () => <StatusBarSurface floatingTerminalOpen={false} />
})
