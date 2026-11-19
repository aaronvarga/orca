import { useBoundedHostRows } from '@/components/host-picker/use-bounded-host-rows'
import { HostListSearchField } from '@/components/host-picker/HostListSearchField'
import { HostListOverflowNote } from '@/components/host-picker/HostListOverflowNote'
import { useState } from 'react'
import { ChevronDown, Grid2X2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import type { CommandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'
import { TabLayoutMenuItems } from './TabLayoutMenuItems'

export function CommandCenterViewMenu({
  presentation,
  onChange,
  projects,
  hosts,
  showHidden,
  onShowHiddenChange
}: {
  presentation: CommandCenterPresentation
  onChange: (value: CommandCenterPresentation) => void
  projects: [string, string][]
  hosts: [string, string][]
  showHidden: boolean
  onShowHiddenChange: (value: boolean) => void
}) {
  const t = useTranslate()
  const hostRows = useBoundedHostRows(hosts.map(([id, label]) => ({ id, label })))
  const [open, setOpen] = useState(false)
  const update = (patch: Partial<CommandCenterPresentation>) =>
    onChange({ ...presentation, ...patch })
  const label =
    presentation.layout === 'auto-grid'
      ? t('commandCenter.autoGrid', 'Auto Grid')
      : presentation.layout === 'auto-columns'
        ? t('commandCenter.autoColumns', 'Auto Columns')
        : `${presentation.columns} × ${presentation.rows}`
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('commandCenter.viewOptions', 'View options')}
        >
          <Grid2X2 className="size-4" />
          {label}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <TabLayoutMenuItems value={presentation} onChange={update} />
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={presentation.groupByProject}
          onCheckedChange={(groupByProject) => update({ groupByProject })}
        >
          {t('commandCenter.group', 'Group by project')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('commandCenter.projectFilter', 'Project filter')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={presentation.project}
          onValueChange={(project) => {
            update({ project })
            setOpen(false)
          }}
        >
          <DropdownMenuRadioItem value="all">
            {t('commandCenter.allProjects', 'All projects')}
          </DropdownMenuRadioItem>
          {projects.map(([id, label]) =>
            id ? (
              <DropdownMenuRadioItem key={id} value={id}>
                {label}
              </DropdownMenuRadioItem>
            ) : null
          )}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('commandCenter.hostFilter', 'Host filter')}</DropdownMenuLabel>
        {hostRows.searchable ? (
          <HostListSearchField value={hostRows.query} onChange={hostRows.setQuery} inMenu />
        ) : null}
        <DropdownMenuRadioGroup
          value={presentation.host}
          onValueChange={(host) => {
            update({ host })
            setOpen(false)
          }}
        >
          <DropdownMenuRadioItem value="all">
            {t('commandCenter.allHosts', 'All hosts')}
          </DropdownMenuRadioItem>
          {hostRows.shown.map(({ id, label }) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <HostListOverflowNote hiddenCount={hostRows.hiddenCount} />
        {presentation.hidden.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={showHidden} onCheckedChange={onShowHiddenChange}>
              {t('commandCenter.showHidden', 'Show Hidden')}
            </DropdownMenuCheckboxItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
