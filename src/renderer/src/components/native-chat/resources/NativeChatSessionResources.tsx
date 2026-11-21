import { ChevronRight, FileText, Files, Globe, Image, Paperclip } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { useNativeChatLinkClick } from '../links/actions/native-chat-link-click-context'
import { NativeChatBrowserRunPageButton } from '../tools/runs/NativeChatBrowserPageButton'
import type {
  SessionResource,
  SessionResources
} from '../../../../../shared/native-chat/session-resources'

function ResourceSection({ title, entries }: { title?: string; entries: SessionResource[] }) {
  const onLinkClick = useNativeChatLinkClick()
  const t = useTranslate()
  const changes = {
    added: t('components.native-chat.resources.created', 'Created'),
    edited: t('components.native-chat.resources.modified', 'Modified'),
    deleted: t('components.native-chat.resources.deleted', 'Deleted'),
    renamed: t('components.native-chat.resources.renamed', 'Renamed')
  }
  if (!entries.length) {
    return null
  }
  return (
    <section className="min-w-0 space-y-1">
      {title ? (
        <h3 className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
          {title}
          <Badge variant="count">{entries.length}</Badge>
        </h3>
      ) : null}
      <ul className="min-w-0">
        {entries.map((entry) => {
          const Icon = entry.kind === 'web' ? Globe : entry.kind === 'image' ? Image : FileText
          const available = entry.kind === 'web' || !!onLinkClick
          return (
            <li key={entry.href} className="min-w-0">
              <a
                href={available ? entry.href : undefined}
                target={entry.kind === 'web' ? '_blank' : undefined}
                rel={entry.kind === 'web' ? 'noreferrer' : undefined}
                aria-disabled={!available || undefined}
                title={entry.detail}
                className="flex min-w-0 items-start gap-2 rounded-md px-2 py-2 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={(event) => {
                  event.stopPropagation()
                  if (entry.kind !== 'web') {
                    event.preventDefault()
                    onLinkClick?.(event, entry.href)
                  }
                }}
              >
                <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{entry.label}</span>
                  <span className="block truncate font-mono text-2xs text-muted-foreground">
                    {entry.detail}
                  </span>
                </span>
                {entry.change ? (
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {changes[entry.change]}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function NativeChatSessionResources({
  resources,
  historyIncomplete
}: {
  resources: SessionResources
  historyIncomplete?: boolean
}) {
  const t = useTranslate()
  const count =
    resources.links.length +
    resources.outputs.length +
    resources.uploads.length +
    resources.sources.length +
    resources.changedFiles.length
  return (
    <div className="min-w-0 space-y-4 px-1 py-2" data-native-chat-session-resources="">
      {resources.browserCalls.length ? (
        <div className="hidden items-center justify-between gap-2 px-2 text-xs text-muted-foreground has-[button]:flex">
          <span>{t('components.native-chat.resources.browser', 'Browser')}</span>
          <NativeChatBrowserRunPageButton calls={resources.browserCalls} />
        </div>
      ) : null}
      {count ? (
        <>
          <ResourceSection
            title={t('components.native-chat.resources.outputs', 'Outputs')}
            entries={resources.outputs}
          />
          <ResourceSection
            title={t('components.native-chat.resources.links', 'Links')}
            entries={resources.links}
          />
          {resources.changedFiles.length ? (
            <Collapsible>
              <CollapsibleTrigger variant="summary" className="group">
                <ChevronRight
                  aria-hidden
                  className="size-3.5 shrink-0 group-data-[state=open]:rotate-90"
                />
                <span className="flex-1 text-left">
                  {t('components.native-chat.resources.changedFiles', 'Changed files')}
                </span>
                <Badge variant="count">{resources.changedFiles.length}</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ResourceSection entries={resources.changedFiles} />
              </CollapsibleContent>
            </Collapsible>
          ) : null}
          <ResourceSection
            title={t('components.native-chat.resources.uploads', 'Uploads')}
            entries={resources.uploads}
          />
          <ResourceSection
            title={t('components.native-chat.resources.sources', 'Sources')}
            entries={resources.sources}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-muted-foreground">
          <Files aria-hidden className="size-5" />
          <p className="text-sm font-medium">
            {t('components.native-chat.resources.empty', 'No files or sources yet')}
          </p>
          <p className="text-xs">
            {t(
              'components.native-chat.resources.emptyHint',
              'Files changed, uploads, and sources used in this conversation appear here.'
            )}
          </p>
        </div>
      )}
      {historyIncomplete ? (
        <p className="flex gap-2 border-t border-border px-2 pt-2 text-xs text-muted-foreground">
          <Paperclip aria-hidden className="size-3.5 shrink-0" />
          {t(
            'components.native-chat.resources.earlierHistory',
            'Showing loaded messages. Load earlier conversation history to include more files and sources.'
          )}
        </p>
      ) : null}
    </div>
  )
}
