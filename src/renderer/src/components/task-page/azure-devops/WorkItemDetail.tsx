import { Button } from '@/components/ui/button'
import { useIntlLocale, useTranslate } from '@/i18n/use-translate'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import type { AzureDevOpsWorkItem } from '../../../../../shared/azure-devops/boards-types'
import { AzureDevOpsWorkItemHtml } from './work-item-html'

export function AzureWorkItemDetail({
  detail,
  onBack,
  onLaunch
}: {
  detail: AzureDevOpsWorkItem | null
  onBack: () => void
  onLaunch: (item: AzureDevOpsWorkItem) => void
}): React.JSX.Element {
  const t = useTranslate()
  const locale = useIntlLocale()
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t('azure.tasks.back', 'Back to work items')}
        </Button>
        {detail && (
          <>
            <Button size="sm" onClick={() => onLaunch(detail)}>
              {t('azure.tasks.launch', 'Launch')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => openAppHttpLink(detail.url, { event })}
            >
              {t('azure.tasks.external', 'Open in Azure DevOps')}
            </Button>
          </>
        )}
      </div>
      {detail && (
        <div className="min-h-0 overflow-auto scrollbar-sleek rounded-md border p-4">
          <h2 className="text-lg font-semibold">
            {t('azure.tasks.itemHeading', 'AB#{{id}} {{title}}', {
              id: detail.id,
              title: detail.title
            })}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {[
              detail.type,
              detail.state,
              detail.assignee,
              detail.updatedAt
                ? new Date(detail.updatedAt).toLocaleString(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })
                : ''
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[detail.area, detail.iteration, detail.tags].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-4">
            <AzureDevOpsWorkItemHtml html={detail.description} />
          </div>
          {detail.acceptanceCriteria && (
            <section className="mt-4">
              <h3 className="mb-2 font-semibold">
                {t('azure.tasks.acceptance', 'Acceptance criteria')}
              </h3>
              <AzureDevOpsWorkItemHtml html={detail.acceptanceCriteria} />
            </section>
          )}
          {detail.related.map((link) => (
            <Button
              key={`${link.label}:${link.id}`}
              variant="link"
              onClick={(event) => openAppHttpLink(link.url, { event })}
            >
              {link.label} {t('azure.tasks.reference', 'AB#{{id}}', { id: link.id })}
            </Button>
          ))}
        </div>
      )}
    </>
  )
}
