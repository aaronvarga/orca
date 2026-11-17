import { normalizeAzureDevOpsCollectionUrl } from './connection-url'
export function parseAzureDevOpsWorkItemUrl(
  value: string
): { baseUrl: string; project: string | null; id: number; url: string } | null {
  try {
    const url = new URL(value)
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) {
      return null
    }
    const match = /^(.*)\/_workitems\/edit\/(\d+)\/?$/i.exec(url.pathname)
    if (!match) {
      return null
    }
    const id = Number(match[2])
    if (!Number.isSafeInteger(id) || id <= 0) {
      return null
    }
    const parts = match[1].split('/').filter(Boolean)
    const cloud = url.hostname === 'dev.azure.com' || url.hostname.endsWith('.visualstudio.com')
    const minimum = url.hostname === 'dev.azure.com' ? 1 : 0
    const project = parts.length > minimum ? decodeURIComponent(parts.pop()!) : null
    if (!cloud && !project) {
      return null
    }
    const baseUrl = normalizeAzureDevOpsCollectionUrl(`${url.origin}/${parts.join('/')}`)
    return {
      baseUrl,
      project,
      id,
      url: `${baseUrl}${project ? `/${encodeURIComponent(project)}` : ''}/_workitems/edit/${id}`
    }
  } catch {
    return null
  }
}
