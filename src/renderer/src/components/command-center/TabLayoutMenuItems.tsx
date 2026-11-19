import { useState } from 'react'
import {
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import type { CommandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'
import { COMMAND_CENTER_PRESETS } from './command-center-layout'

export type TabLayout = Pick<CommandCenterPresentation, 'layout' | 'columns' | 'rows'>

export function TabLayoutMenuItems({
  value,
  onChange
}: {
  value: TabLayout
  onChange: (value: TabLayout) => void
}) {
  const t = useTranslate()
  const [customOpen, setCustomOpen] = useState(false)
  const [preview, setPreview] = useState<[number, number]>([1, 1])
  const selected = value.layout === 'manual' ? `${value.columns}x${value.rows}` : value.layout
  const update = (patch: Partial<TabLayout>) => onChange({ ...value, ...patch })
  return (
    <>
      <DropdownMenuRadioGroup value={selected}>
        <DropdownMenuRadioItem value="auto-grid" onSelect={() => update({ layout: 'auto-grid' })}>
          {t('commandCenter.autoGrid', 'Auto Grid')}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem
          value="auto-columns"
          onSelect={() => update({ layout: 'auto-columns' })}
        >
          {t('commandCenter.autoColumns', 'Auto Columns')}
        </DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        {COMMAND_CENTER_PRESETS.map(([columns, rows]) => (
          <DropdownMenuRadioItem
            key={`${columns}x${rows}`}
            value={`${columns}x${rows}`}
            onSelect={() => update({ layout: 'manual', columns, rows })}
          >
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
    </>
  )
}
