import { setTimeout as delay } from 'node:timers/promises'
import { savedAzureDevOpsConnections, savedAzureDevOpsToken } from './connection-store'
import {
  normalizeAzureDevOpsCollectionUrl,
  azureDevOpsCollectionForProjectUrl
} from '../../shared/azure-devops/connection-url'
import { Buffer } from 'node:buffer'
import type { AzureDevOpsRepoRef } from './repository-ref'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'

const REQUEST_TIMEOUT_MS = 5000
// Newest first: older on-prem Servers reject newer versions with VssVersionOutOfRangeException.
const API_VERSIONS: readonly string[] = ['7.1', '6.1', '5.1']
// Each retry either lowers the version or adds -preview once, so this bounds negotiation.
export const AZURE_DEVOPS_MAX_REQUEST_ATTEMPTS = API_VERSIONS.length + 1

// Remember origins that require the -preview API version suffix.
const previewApiVersionOrigins = new Set<string>()
const apiVersionIndexByOrigin = new Map<string, number>()

/** @internal - exposed for tests only */
export function _resetAzureDevOpsApiVersionCache(): void {
  previewApiVersionOrigins.clear()
  apiVersionIndexByOrigin.clear()
}

export function azureDevOpsApiVersionForOrigin(origin: string): string {
  const version = API_VERSIONS[apiVersionIndexByOrigin.get(origin) ?? 0]
  return previewApiVersionOrigins.has(origin) ? `${version}-preview` : version
}

function errorTypeKey(body: string): unknown {
  try {
    const parsed: unknown = JSON.parse(body)
    return typeof parsed === 'object' && parsed !== null && 'typeKey' in parsed
      ? parsed.typeKey
      : null
  } catch {
    return null
  }
}

/** Returns true when the rejected request should be retried with the newly negotiated version. */
export function recordAzureDevOpsApiVersionRejection(
  url: URL,
  status: number | null,
  body: string
): boolean {
  const typeKey = status === 400 ? errorTypeKey(body) : null
  const requested = url.searchParams.get('api-version') ?? ''
  if (typeKey === 'VssInvalidPreviewVersionException' && !requested.endsWith('-preview')) {
    previewApiVersionOrigins.add(url.origin)
    return true
  }
  if (typeKey !== 'VssVersionOutOfRangeException') {
    return false
  }
  const next = API_VERSIONS.indexOf(requested.replace(/-preview$/, '')) + 1
  if (next === 0 || next >= API_VERSIONS.length) {
    return false
  }
  // Never move back up: a concurrent request may already have negotiated lower.
  apiVersionIndexByOrigin.set(
    url.origin,
    Math.max(next, apiVersionIndexByOrigin.get(url.origin) ?? 0)
  )
  return true
}

export type AzureDevOpsAuthConfig = {
  apiBaseUrl: string | null
  pat: string | null
  accessToken: string | null
  username: string | null
  savedConnectionId?: string
}

export class AzureDevOpsCredentialAccessError extends Error {
  constructor(
    readonly status: number,
    path: string
  ) {
    const permission = path.includes('/_apis/git/')
      ? 'Code Read'
      : path.includes('/_apis/projects')
        ? 'Project and Team Read'
        : 'Work Items Read'
    super(
      status === 401
        ? 'Azure DevOps credential expired or is invalid. Reconnect this organization in Settings.'
        : `Azure DevOps permission denied. Reconnect this organization with ${permission} access.`
    )
    this.name = 'AzureDevOpsCredentialAccessError'
  }
}

export type AzureDevOpsRequestOptions = {
  searchParams?: Record<string, string | number>
  timeoutMs?: number
  onResponse?: (response: Response) => void
  signal?: AbortSignal
  body?: unknown
  authorization?: string
}

function envValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function normalizeAzureDevOpsApiBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/_apis$/i, '')
}

export function getAzureDevOpsAuthConfig(): AzureDevOpsAuthConfig {
  return {
    apiBaseUrl: envValue('ORCA_AZURE_DEVOPS_API_BASE_URL'),
    pat: envValue('ORCA_AZURE_DEVOPS_TOKEN') ?? envValue('ORCA_AZURE_DEVOPS_PAT'),
    accessToken: envValue('ORCA_AZURE_DEVOPS_ACCESS_TOKEN'),
    username: envValue('ORCA_AZURE_DEVOPS_USERNAME')
  }
}

export function azureDevOpsTokenConfigured(config: AzureDevOpsAuthConfig): boolean {
  return Boolean(config.pat || config.accessToken)
}

export function azureDevOpsAuthHeaders(config: AzureDevOpsAuthConfig): Record<string, string> {
  if (config.accessToken) {
    return { Authorization: `Bearer ${config.accessToken}` }
  }
  if (config.pat) {
    const encoded = Buffer.from(`${config.username ?? ''}:${config.pat}`).toString('base64')
    return { Authorization: `Basic ${encoded}` }
  }
  return {}
}

export function resolveAzureDevOpsAuthConfig(baseUrl: string): AzureDevOpsAuthConfig {
  const saved = savedAzureDevOpsConnections().find((connection) => {
    try {
      return (
        connection.baseUrl === normalizeAzureDevOpsCollectionUrl(baseUrl) ||
        connection.baseUrl === azureDevOpsCollectionForProjectUrl(baseUrl)
      )
    } catch {
      try {
        return connection.baseUrl === azureDevOpsCollectionForProjectUrl(baseUrl)
      } catch {
        return false
      }
    }
  })
  return saved
    ? {
        apiBaseUrl: baseUrl,
        savedConnectionId: saved.id,
        pat: savedAzureDevOpsToken(saved),
        accessToken: null,
        username: null
      }
    : getAzureDevOpsAuthConfig()
}

function isUrlPathAncestor(ancestor: string, descendant: string): boolean {
  try {
    const ancestorUrl = new URL(ancestor)
    const descendantUrl = new URL(descendant)
    const ancestorPath = ancestorUrl.pathname.replace(/\/+$/, '')
    const descendantPath = descendantUrl.pathname.replace(/\/+$/, '')
    return (
      ancestorUrl.origin === descendantUrl.origin &&
      (ancestorPath === descendantPath || descendantPath.startsWith(`${ancestorPath}/`))
    )
  } catch {
    return false
  }
}

export function resolveAzureDevOpsGitApiBaseUrl(repo: AzureDevOpsRepoRef): string {
  const config = resolveAzureDevOpsAuthConfig(repo.apiBaseUrl)
  const configured = config.apiBaseUrl
  if (!configured) {
    return repo.apiBaseUrl
  }
  const normalized = normalizeAzureDevOpsApiBaseUrl(configured)
  // Git endpoints need the remote's project path, even when auth probes use a collection URL.
  return isUrlPathAncestor(normalized, repo.apiBaseUrl) ? repo.apiBaseUrl : normalized
}

function apiUrl(
  baseUrl: string,
  path: string,
  searchParams?: AzureDevOpsRequestOptions['searchParams']
): URL {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[?#]/.test(path) ||
    path.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new Error('Invalid Azure DevOps API path.')
  }
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}${path}`)
  const params = {
    ...searchParams,
    'api-version': azureDevOpsApiVersionForOrigin(url.origin)
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url
}

export async function requestAzureDevOpsJsonAtBase<T>(
  baseUrl: string,
  path: string,
  options: AzureDevOpsRequestOptions = {},
  // Creation preflight must distinguish lookup failure from an absent PR.
  throwOnFailure = false
): Promise<T | null> {
  const config = options.authorization ? null : resolveAzureDevOpsAuthConfig(baseUrl)
  const doFetch = (url: URL): Promise<Response> =>
    fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(options.authorization
          ? { Authorization: options.authorization }
          : azureDevOpsAuthHeaders(config!))
      },
      method: options.body === undefined ? 'GET' : 'POST',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'error',
      signal: options.signal
        ? AbortSignal.any([
            options.signal,
            AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
          ])
        : AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
    })
  try {
    for (let attempt = 1; ; attempt++) {
      const url = apiUrl(baseUrl, path, options.searchParams)
      const response = await doFetch(url)
      if (response.ok) {
        options.onResponse?.(response)
        return (await response.json()) as T
      }
      if (response.status === 429 && attempt <= 2) {
        const retryAfter = response.headers.get('retry-after') ?? '1'
        const milliseconds = /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Date.parse(retryAfter) - Date.now()
        await cancelUnreadResponseBody(response)
        if (Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= 2000) {
          await delay(milliseconds, undefined, { signal: options.signal })
          continue
        }
      }
      const body = response.status === 400 ? await response.text().catch(() => '') : ''
      await cancelUnreadResponseBody(response)
      if (
        attempt >= AZURE_DEVOPS_MAX_REQUEST_ATTEMPTS ||
        !recordAzureDevOpsApiVersionRejection(url, response.status, body)
      ) {
        if (
          (response.status === 401 || response.status === 403) &&
          (config?.savedConnectionId || throwOnFailure)
        ) {
          throw new AzureDevOpsCredentialAccessError(response.status, path)
        }
        if (throwOnFailure) {
          throw new Error(
            `Azure DevOps request failed: HTTP ${response.status}${response.status === 401 ? ' (expired or invalid credential)' : response.status === 403 ? ' (permission denied for this operation)' : ''}`
          )
        }
        return null
      }
    }
  } catch (error) {
    if (throwOnFailure || error instanceof AzureDevOpsCredentialAccessError) {
      throw error
    }
    return null
  }
}

export function requestAzureDevOpsJson<T>(
  repo: AzureDevOpsRepoRef,
  path: string,
  options: AzureDevOpsRequestOptions = {},
  throwOnFailure = false
): Promise<T | null> {
  return requestAzureDevOpsJsonAtBase(
    resolveAzureDevOpsGitApiBaseUrl(repo),
    path,
    options,
    throwOnFailure
  )
}
