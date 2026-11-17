import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import type { AzureDevOpsWorkItem } from '../../../../../shared/azure-devops/boards-types'
export function AzureWorkItemList({
  items,
  onOpenItem
}: {
  items: AzureDevOpsWorkItem[]
  onOpenItem: (id: number) => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  return (
    <div className="@container min-h-0 overflow-auto scrollbar-sleek rounded-md border">
      <table className="w-full text-sm [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-2 [&_tr]:border-b [&_tr]:border-border/50">
        <thead>
          <tr>
            <th>{t('azure.tasks.item', 'Work item')}</th>
            <th className="hidden @sm:table-cell">{t('azure.tasks.type', 'Type')}</th>
            <th className="hidden @sm:table-cell">{t('azure.tasks.state', 'State')}</th>
            <th className="hidden @sm:table-cell">{t('azure.tasks.assignee', 'Assignee')}</th>
            <th className="hidden @sm:table-cell">{t('azure.tasks.updated', 'Updated')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <button
                  type="button"
                  aria-label={t('azure.tasks.itemHeading', 'AB#{{id}} {{title}}', {
                    id: item.id,
                    title: item.title
                  })}
                  className="text-left hover:underline focus-visible:outline-ring"
                  onClick={() => onOpenItem(item.id)}
                >
                  <span className="mr-2 font-mono text-muted-foreground">
                    {t('azure.tasks.reference', 'AB#{{id}}', { id: item.id })}
                  </span>
                  {item.title}
                </button>
                <p className="mt-1 text-xs text-muted-foreground @sm:hidden">
                  {[item.type, item.state, item.assignee].filter(Boolean).join(' · ')}
                </p>
              </td>
              <td className="hidden @sm:table-cell">{item.type}</td>
              <td className="hidden @sm:table-cell">{item.state}</td>
              <td className="hidden @sm:table-cell">{item.assignee}</td>
              <td className="hidden whitespace-nowrap @sm:table-cell">
                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(locale) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
