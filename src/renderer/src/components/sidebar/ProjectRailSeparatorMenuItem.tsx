import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Minus } from 'lucide-react'

export function ProjectRailSeparatorMenuItem({ rowKey }: { rowKey: string }) {
  const t = useTranslate()
  const separators = useAppStore((s) => s.projectRailSeparators) ?? []
  const exists = separators.includes(rowKey)
  return (
    <DropdownMenuItem
      onSelect={() =>
        useAppStore
          .getState()
          .setProjectRailSeparators(
            exists ? separators.filter((key) => key !== rowKey) : [...separators, rowKey]
          )
      }
    >
      <Minus className="size-4" />
      {exists
        ? t('sidebar.removeRailSeparator', 'Remove separator above')
        : t('sidebar.addRailSeparator', 'Add separator above')}
    </DropdownMenuItem>
  )
}
