import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { selectExecutionHostDisplayLabel } from '@/runtime/hosts/display/execution-host-display-label'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'
import { isRepoHidden } from '../../../../shared/project/catalog/hidden-projects'
import { compareRootProjectEntries } from '../../../../shared/sidebar-list/sections/root-project-order'
import { setProjectHidden } from './hidden-projects/set-project-hidden'

export function ProjectVisibilityMenu() {
  const t = useTranslate()
  const repos = useAppStore((s) => s.repos)
  const groups = useAppStore((s) => s.projectGroups)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const entries = [
    ...repos.map((repo) => ({ kind: 'repo' as const, repo })),
    ...groups
      .filter((group) => group.parentPath)
      .map((group) => ({ kind: 'group' as const, group }))
  ].sort((a, b) => compareRootProjectEntries(a, b))
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('sidebar.projectVisibility', 'Project visibility')}
            >
              <Eye className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          {t('sidebar.projectVisibility', 'Project visibility')}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="right" align="end" className="w-72">
        <DropdownMenuLabel>
          {t('sidebar.projectVisibility', 'Project visibility')}
        </DropdownMenuLabel>
        {entries.map((entry) => {
          const row = entry.kind === 'repo' ? entry.repo : entry.group
          const hostId = getRepoExecutionHostId(row)
          const key = JSON.stringify([entry.kind, hostId, row.id, row.connectionId])
          const name = entry.kind === 'repo' ? entry.repo.displayName : entry.group.name
          const visible = entry.kind === 'repo' ? !isRepoHidden(entry.repo) : !entry.group.hiddenAt
          const toggle = async (checked: boolean) => {
            setPending((prior) => new Set(prior).add(key))
            const operation =
              entry.kind === 'repo'
                ? setProjectHidden([entry.repo], !checked, name)
                : useAppStore
                    .getState()
                    .updateProjectGroup(
                      entry.group.id,
                      { hiddenAt: checked ? null : Date.now() },
                      { hostId }
                    )
            await operation
              .then((saved) => {
                if (!saved && entry.kind === 'group') {
                  toast.error(
                    t('sidebar.projectVisibilityFailed', "Couldn't change project visibility.")
                  )
                }
              })
              .finally(() => {
                setPending((prior) => {
                  const next = new Set(prior)
                  next.delete(key)
                  return next
                })
              })
          }
          return (
            <DropdownMenuCheckboxItem
              key={key}
              checked={visible}
              disabled={pending.has(key)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => void toggle(checked)}
            >
              {entry.kind === 'repo' ? (
                <RepoIconGlyph
                  repoIcon={entry.repo.repoIcon}
                  color={entry.repo.badgeColor}
                  className="size-4 shrink-0"
                  iconClassName="size-4"
                />
              ) : (
                <RepoIconGlyph
                  repoIcon={entry.group.repoIcon}
                  color={entry.group.color ?? undefined}
                  className="size-4 shrink-0"
                  iconClassName="size-4"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{name}</span>
              {hostId !== 'local' ? (
                <span className="text-2xs text-muted-foreground">
                  {selectExecutionHostDisplayLabel(useAppStore.getState(), hostId)}
                </span>
              ) : null}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
