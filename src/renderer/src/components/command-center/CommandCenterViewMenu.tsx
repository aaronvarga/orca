import { useState } from 'react'
import { ChevronDown, Grid2X2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import type { CommandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'
import { COMMAND_CENTER_PRESETS } from './command-center-layout'

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
  const [open, setOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [preview, setPreview] = useState<[number, number]>([1, 1])
  const update = (patch: Partial<CommandCenterPresentation>) =>
    onChange({ ...presentation, ...patch })
  const selected =
    presentation.layout === 'manual'
      ? `${presentation.columns}x${presentation.rows}`
      : presentation.layout
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
        <DropdownMenuRadioGroup
          value={selected}
          onValueChange={(value) => {
            if (value === 'auto-grid' || value === 'auto-columns') {
              update({ layout: value })
            } else {
              const [columns, rows] = value.split('x').map(Number)
              update({ layout: 'manual', columns, rows })
            }
          }}
        >
          <DropdownMenuRadioItem value="auto-grid">
            {t('commandCenter.autoGrid', 'Auto Grid')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="auto-columns">
            {t('commandCenter.autoColumns', 'Auto Columns')}
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {COMMAND_CENTER_PRESETS.map(([columns, rows]) => (
            <DropdownMenuRadioItem key={`${columns}x${rows}`} value={`${columns}x${rows}`}>
              {columns} × {rows}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuItem
          aria-expanded={customOpen}
          onSelect={(event) => {
            event.preventDefault()
            setCustomOpen(!customOpen)
          }}
        >
          {t('commandCenter.customLayout', 'Custom layout…')}
        </DropdownMenuItem>
        {customOpen ? (
          <>
            <div
              className="grid grid-cols-10 gap-1 p-2"
              aria-label={t('commandCenter.customLayout', 'Custom layout…')}
            >
              {Array.from({ length: 80 }, (_, index) => {
                const columns = (index % 10) + 1
                const rows = Math.floor(index / 10) + 1
                return (
                  <div
                    key={index}
                    className={`flex size-6 items-center justify-center rounded-md border border-border ${columns <= preview[0] && rows <= preview[1] ? 'bg-accent' : ''}`}
                  >
                    <DropdownMenuItem
                      className="size-5"
                      aria-label={`${columns} × ${rows}`}
                      onPointerMove={() => setPreview([columns, rows])}
                      onFocus={() => setPreview([columns, rows])}
                      onSelect={() => {
                        update({ layout: 'manual', columns, rows })
                        setOpen(false)
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="px-2 pb-2 text-center text-xs text-muted-foreground">
              {preview[0]} × {preview[1]}
            </div>
          </>
        ) : null}
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
          {hosts.map(([id, label]) => (
            <DropdownMenuRadioItem key={id} value={id}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

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
