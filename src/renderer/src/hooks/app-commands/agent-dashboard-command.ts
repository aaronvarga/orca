import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import type { AppState } from '../../store/types'
import { resolveAgentDashboardMode } from '../../components/dashboard/settings/agent-dashboard-open-mode'

export function toggleAgentDashboardFromShortcut(
  state: Pick<
    AppState,
    'activeView' | 'agentDashboardDrawerOpen' | 'setAgentDashboardDrawerOpen'
  > & {
    settings: Pick<
      GlobalSettings,
      'experimentalAgentDashboardPopout' | 'experimentalAgentDashboardMode'
    > | null
  },
  openPopout: () => void
): void {
  if (
    state.activeView === 'settings' ||
    state.settings?.experimentalAgentDashboardPopout !== true
  ) {
    return
  }
  if (resolveAgentDashboardMode(state.settings) === 'popout') {
    openPopout()
    return
  }
  state.setAgentDashboardDrawerOpen(!state.agentDashboardDrawerOpen)
}
