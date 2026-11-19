import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Folder, RefreshCw } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import { stopRepoHeaderMenuEvent } from './worktree-list/rows/header-event-guards'
import { joinPath, basename } from '@/lib/path'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import type { DirEntry } from '../../../../shared/file-listing/directory-entry'
import { readFolderGroupDirectory, openFolderGroupDirectory } from './folder-group-navigation'

export function FolderGroupBrowser({
  group,
  autoFocus = true,
  onOpened
}: {
  group: ProjectGroup
  autoFocus?: boolean
  onOpened: () => void
}) {
  const t = useTranslate()
  const [paths, setPaths] = useState([group.parentPath ?? ''])
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const path = paths.at(-1) ?? group.parentPath ?? ''
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void readFolderGroupDirectory(group, path)
      .then((entries) => {
        if (!cancelled) {
          setEntries(entries)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [group, path, revision])
  const open = async (path: string) => {
    setOpening(true)
    setError(null)
    await openFolderGroupDirectory(group, path)
      .then(onOpened)
      .catch((error: unknown) => setError(error instanceof Error ? error.message : String(error)))
      .finally(() => setOpening(false))
  }
  return (
    <PopoverContent
      side="right"
      align="start"
      className="w-80"
      onOpenAutoFocus={(event) => {
        if (!autoFocus) {
          event.preventDefault()
        }
      }}
      onCloseAutoFocus={(event) => {
        if (!autoFocus) {
          event.preventDefault()
        }
      }}
      onPointerDown={stopRepoHeaderMenuEvent}
      onClick={stopRepoHeaderMenuEvent}
      onKeyDown={stopRepoHeaderMenuEvent}
    >
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          {paths.length > 1 ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setPaths(paths.slice(0, -1))}
              aria-label={t('sidebar.folderGroupBack', 'Back to parent folder')}
            >
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {paths.length === 1 ? group.name : basename(path)}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRevision(revision + 1)}
            disabled={loading || opening}
            aria-label={t('sidebar.folderGroupRefresh', 'Refresh folders')}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mb-2 w-full"
          disabled={opening || loading}
          onClick={() => void open(path)}
        >
          {t('sidebar.folderGroupOpenFolder', 'Open this folder')}
        </Button>
        {error ? (
          <p role="alert" className="py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p role="status" className="py-2 text-xs text-muted-foreground">
            {t('sidebar.folderGroupLoading', 'Loading folders…')}
          </p>
        ) : null}
        {!loading && !error && entries.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            {t('sidebar.folderGroupEmpty', 'No subfolders')}
          </p>
        ) : null}
        <div className="scrollbar-sleek max-h-80 overflow-y-auto">
          {!loading &&
            !error &&
            entries.map((entry) => (
              <div className="flex items-center gap-1" key={entry.name}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-0 flex-1 justify-start"
                  disabled={opening}
                  onClick={() => void open(joinPath(path, entry.name))}
                >
                  <Folder className="size-4" />
                  <span className="truncate">{entry.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={opening}
                  aria-label={t('sidebar.folderGroupBrowse', 'Browse {{name}}', {
                    name: entry.name
                  })}
                  onClick={() => setPaths([...paths, joinPath(path, entry.name)])}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ))}
        </div>
      </div>
    </PopoverContent>
  )
}

export function FolderGroupBrowserButton({ group }: { group: ProjectGroup }) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const label = t('sidebar.folderGroupBrowse', 'Browse {{name}}', { name: group.name })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-4"
              data-repo-header-action=""
              aria-label={label}
              onPointerDown={stopRepoHeaderMenuEvent}
              onClick={stopRepoHeaderMenuEvent}
              onKeyDown={stopRepoHeaderMenuEvent}
            >
              <RepoIconGlyph
                repoIcon={group.repoIcon}
                color={group.color ?? undefined}
                className="size-4"
                iconClassName="size-3.5"
              />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      {open ? (
        <FolderGroupBrowser key={group.parentPath} group={group} onOpened={() => setOpen(false)} />
      ) : null}
    </Popover>
  )
}
