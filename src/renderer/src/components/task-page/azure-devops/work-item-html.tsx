import DOMPurify from 'dompurify'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'

export const azureDevOpsHtmlConfig = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'div',
    'span',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'h1',
    'h2',
    'h3',
    'h4',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a'
  ],
  ALLOWED_ATTR: ['href', 'title', 'colspan', 'rowspan'],
  ALLOW_DATA_ATTR: false
}

export function sanitizeAzureDevOpsHtml(html: string): string {
  return DOMPurify.sanitize(html, azureDevOpsHtmlConfig)
}

export function AzureDevOpsWorkItemHtml({ html }: { html: string }): React.JSX.Element {
  return (
    <div
      className="markdown-body text-sm"
      onClick={(event) => {
        const anchor = event.target instanceof Element ? event.target.closest('a') : null
        if (!anchor) {
          return
        }
        event.preventDefault()
        const href = anchor.getAttribute('href')
        if (href && /^https?:\/\//i.test(href)) {
          openAppHttpLink(href, { event })
        }
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeAzureDevOpsHtml(html) }}
    />
  )
}
