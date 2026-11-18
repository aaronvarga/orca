import { ArrowUpCircle, Settings } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'

export function SettingsUpdateIcon({ available }: { available: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Settings className="size-4" />
      {available ? (
        <ArrowUpCircle
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 size-3 rounded-full bg-sidebar text-status-success"
        />
      ) : null}
    </span>
  )
}

export function useSettingsUpdateAction() {
  const t = useTranslate()
  const release = useAppStore((state) => state.forkReleaseStatus?.releaseTag)
  return {
    available: !!release,
    label: release
      ? t('forkUpdates.settingsAvailable', 'Settings — upstream update {{tag}} available', {
          tag: release
        })
      : t('commandCenter.settings', 'Settings'),
    open: () => {
      const state = useAppStore.getState()
      if (release) {
        state.openSettingsTarget({ pane: 'general', repoId: null, sectionId: 'fork-updates' })
      }
      state.openSettingsPage()
    }
  }
}
