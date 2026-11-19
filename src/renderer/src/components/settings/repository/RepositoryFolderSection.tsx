import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getProjectFolderSearchEntry } from './repository-folder-search'
import { useId, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { Repo } from '../../../../../shared/repository/repo-types'
import {
  getRepoExecutionHostId,
  parseExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { getProjectHostSetupForRepo } from '../../../../../shared/project/host-setup/project-host-setup-lookup'
import { useAppStore } from '@/store'
import { getProjectHostSetupProjectionFromState } from '@/store/projects/project-host-setup-selector'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSetting } from '../section-layout/SearchableSetting'
import { RemoteFileBrowser } from '../../sidebar/host-path-browser/RemoteFileBrowser'

export function RepositoryFolderSection({
  repo,
  forceVisible = false
}: {
  repo: Repo
  forceVisible?: boolean
}) {
  const t = useTranslate()
  const inputId = useId()
  const [kind, setKind] = useState<'git' | 'folder'>(repo.kind ?? 'git')
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const projection = useAppStore(getProjectHostSetupProjectionFromState)
  const setup = getProjectHostSetupForRepo(projection.setups, repo)
  const parsedHost = parseExecutionHostId(getRepoExecutionHostId(repo))
  const runtimeEnvironmentId =
    setup.runtimeOwnerEnvironmentId ??
    (parsedHost?.kind === 'runtime' ? parsedHost.environmentId : undefined)
  const path = draft ?? repo.path
  const changed = path.trim() !== repo.path || kind !== (repo.kind ?? 'git')
  const entry = getProjectFolderSearchEntry(repo, t)
  const description = t(
    'settings.projectFolder.description',
    'Change the folder Orca opens for this project. Files are not moved. Existing terminals keep their current working directory.'
  )
  const browse = async () => {
    if (runtimeEnvironmentId) {
      setBrowsing(true)
      return
    }
    try {
      const selected = await window.api.shell.pickDirectory({ defaultPath: path })
      if (selected) {
        setDraft(selected)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }
  return (
    <SearchableSetting
      {...entry}
      description={description}
      forceVisible={forceVisible}
      className="space-y-2 py-3"
    >
      <Label htmlFor={inputId}>{entry.title}</Label>
      <p className="text-settings-detail text-muted-foreground">{description}</p>
      {browsing && runtimeEnvironmentId ? (
        <RemoteFileBrowser
          runtimeEnvironmentId={runtimeEnvironmentId}
          {...(parsedHost?.kind === 'ssh' ? { targetId: parsedHost.targetId } : {})}
          initialPath={path}
          onSelect={(selected) => {
            setDraft(selected)
            setBrowsing(false)
          }}
          onCancel={() => setBrowsing(false)}
        />
      ) : null}
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault()
          if (saving || !changed || !path.trim()) {
            return
          }
          setSaving(true)
          setError(null)
          try {
            const state = useAppStore.getState()
            const result = await state.updateProjectHostSetup(
              {
                setupId: setup.id,
                hostId: setup.hostId,
                updates: { path: path.trim(), ...(kind !== (repo.kind ?? 'git') ? { kind } : {}) }
              },
              { throwOnError: true }
            )
            if (!result) {
              setError(t('settings.projectFolder.failed', 'Could not change the project folder.'))
              return
            }
            setDraft(null)
            await state.fetchWorktrees(repo.id, { executionHostId: getRepoExecutionHostId(repo) })
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause))
          } finally {
            setSaving(false)
          }
        }}
      >
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={path}
            disabled={saving}
            aria-invalid={Boolean(error)}
            variant="code"
            onChange={(event) => {
              setDraft(event.target.value)
              setError(null)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving || (parsedHost?.kind === 'ssh' && !runtimeEnvironmentId)}
            onClick={() => void browse()}
          >
            <FolderOpen className="size-4" />
            {t('settings.projectFolder.browse', 'Browse…')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${inputId}-kind`}>{t('settings.projectFolder.openAs', 'Open as')}</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value === 'folder' ? 'folder' : 'git')
              setError(null)
            }}
            disabled={saving}
          >
            <SelectTrigger id={`${inputId}-kind`} className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="folder">{t('settings.projectFolder.folder', 'Folder')}</SelectItem>
              <SelectItem value="git">
                {t('settings.projectFolder.git', 'Git repository')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <p role="alert" className="text-settings-detail text-destructive">
            {error}
          </p>
        ) : null}
        {changed ? (
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving || !path.trim()}>
              {saving
                ? t('settings.projectFolder.updating', 'Updating…')
                : t('settings.projectFolder.update', 'Change folder')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                setDraft(null)
                setKind(repo.kind ?? 'git')
                setError(null)
              }}
            >
              {t('settings.projectFolder.cancel', 'Cancel')}
            </Button>
          </div>
        ) : null}
      </form>
    </SearchableSetting>
  )
}
