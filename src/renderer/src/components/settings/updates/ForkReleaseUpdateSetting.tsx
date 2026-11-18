import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'
import { launchOrcaForkUpdate } from '@/lib/updater/launch-orca-fork-update'
import { SearchableSetting } from '../section-layout/SearchableSetting'

export function ForkReleaseUpdateSetting() {
  const t = useTranslate()
  const status = useAppStore((state) => state.forkReleaseStatus)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!status) {
    return null
  }
  const releaseTag = status.releaseTag
  return (
    <SearchableSetting
      id="fork-updates"
      title={t('forkUpdates.title', 'Fork updates')}
      keywords={['upstream', 'release', 'rebase']}
      className="space-y-3 py-3"
    >
      <div className="space-y-1">
        <div className="text-sm font-medium">{t('forkUpdates.title', 'Fork updates')}</div>
        <p className="text-xs text-muted-foreground">
          {t(
            'forkUpdates.description',
            'Checks stablyai/orca at startup and hourly. Open Codex to rebase your local fork while preserving your changes and running sessions.'
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {status.releaseTag
            ? t('forkUpdates.available', 'Upstream {{tag}} available · this build {{version}}', {
                tag: status.releaseTag,
                version: status.baseVersion
              })
            : status.checking
              ? t('forkUpdates.checking', 'Checking upstream…')
              : status.error
                ? t('forkUpdates.failed', 'Upstream check unavailable.')
                : t(
                    'forkUpdates.current',
                    'No newer stable upstream release · this build {{version}}',
                    { version: status.baseVersion }
                  )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={status.checking || launching}
          onClick={() => {
            setError(null)
            void window.api.updater.checkForkRelease?.().catch((reason) => setError(String(reason)))
          }}
        >
          {status.checking
            ? t('forkUpdates.checking', 'Checking upstream…')
            : t('forkUpdates.check', 'Check upstream')}
        </Button>
        {releaseTag ? (
          <Button
            size="sm"
            disabled={launching}
            onClick={() => {
              setLaunching(true)
              setError(null)
              void launchOrcaForkUpdate(releaseTag)
                .catch((reason) =>
                  setError(reason instanceof Error ? reason.message : String(reason))
                )
                .finally(() => setLaunching(false))
            }}
          >
            {launching
              ? t('forkUpdates.opening', 'Opening Codex…')
              : t('forkUpdates.rebase', 'Rebase fork in Codex')}
          </Button>
        ) : null}
      </div>
      {error || status.error ? (
        <p role="alert" className="text-xs text-destructive">
          {error ?? status.error}
        </p>
      ) : null}
    </SearchableSetting>
  )
}
