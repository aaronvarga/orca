export function normalizeAzureDevOpsCollectionUrl(value: string): string {
  const url = new URL(value.trim())
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Enter an HTTP(S) organization or collection URL without credentials, query or fragment.'
    )
  }
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (url.hostname.endsWith('.visualstudio.com')) {
    if (parts.length && !(parts.length === 1 && parts[0].toLowerCase() === 'defaultcollection')) {
      throw new Error('Use the organization URL, without a project path.')
    }
    return `https://dev.azure.com/${url.hostname.slice(0, -'.visualstudio.com'.length).toLowerCase()}`
  }
  if (url.hostname === 'dev.azure.com') {
    if (parts.length !== 1 || !/^[a-z0-9][a-z0-9-]*$/i.test(parts[0])) {
      throw new Error('Use https://dev.azure.com/organization.')
    }
    return `https://dev.azure.com/${parts[0].toLowerCase()}`
  }
  if (parts.some((part) => /[\\/?#]/.test(part) || part === '.' || part === '..')) {
    throw new Error('Invalid collection path.')
  }
  return `${url.origin}${parts.length ? `/${parts.map(encodeURIComponent).join('/')}` : ''}`
}

export function azureDevOpsCollectionForProjectUrl(value: string): string {
  const url = new URL(value)
  const parts = url.pathname.split('/').filter(Boolean)
  parts.pop()
  url.pathname = parts.join('/')
  return normalizeAzureDevOpsCollectionUrl(url.toString())
}
