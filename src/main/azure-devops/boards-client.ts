import { workItemSchema, fields, mapItem, azureDevOpsWiql } from './boards-work-item-mapping'
export { azureDevOpsWiql } from './boards-work-item-mapping'
import { z } from 'zod'
import { normalizeAzureDevOpsCollectionUrl } from '../../shared/azure-devops/connection-url'
import type {
  AzureDevOpsConnection,
  AzureDevOpsProject,
  AzureDevOpsSelection,
  AzureDevOpsWorkItem,
  AzureDevOpsWorkItemQuery,
  AzureDevOpsWorkItemResults,
  AzureDevOpsMetadata,
  AzureDevOpsQuery
} from '../../shared/azure-devops/boards-types'
import {
  azureDevOpsAuthHeaders,
  getAzureDevOpsAuthConfig,
  requestAzureDevOpsJsonAtBase
} from './azure-devops-api-request'
import {
  azureDevOpsConnectionStatus,
  disconnectAzureDevOpsConnection,
  publishAzureDevOpsConnection,
  savedAzureDevOpsToken,
  withAzureDevOpsRead
} from './connection-store'

const projectSchema = z.object({ id: z.string().min(1), name: z.string().min(1) })
const querySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  isFolder: z.boolean().optional(),
  queryType: z.string().optional()
})
const segment = encodeURIComponent
const collection = <T extends z.ZodType>(schema: T) => z.object({ value: z.array(schema) })

type Reader = <T>(
  path: string,
  schema: z.ZodType<T>,
  options?: {
    body?: unknown
    searchParams?: Record<string, string | number>
    onResponse?: (response: Response) => void
  }
) => Promise<T>
function reader(baseUrl: string, authorization: string, signal?: AbortSignal): Reader {
  return async (path, schema, options = {}) =>
    schema.parse(
      await requestAzureDevOpsJsonAtBase(
        baseUrl,
        path,
        { ...options, authorization, signal, timeoutMs: 30_000 },
        true
      )
    )
}
function authorizedReader(connection: AzureDevOpsConnection, signal?: AbortSignal): Reader {
  const authorization = azureDevOpsAuthHeaders(
    connection.externallyManaged
      ? getAzureDevOpsAuthConfig()
      : {
          apiBaseUrl: connection.baseUrl,
          pat: savedAzureDevOpsToken(connection),
          accessToken: null,
          username: null
        }
  ).Authorization
  return reader(connection.baseUrl, authorization, signal)
}

async function projects(read: Reader): Promise<AzureDevOpsProject[]> {
  const result: AzureDevOpsProject[] = []
  const seen = new Set<string>()
  let continuationToken = ''
  do {
    let next = ''
    const page = await read('/_apis/projects', collection(projectSchema), {
      searchParams: { $top: 100, ...(continuationToken ? { continuationToken } : {}) },
      onResponse: (response) => {
        next = response.headers.get('x-ms-continuationtoken') ?? ''
      }
    })
    result.push(...page.value)
    if (!next) {
      return result
    }
    if (seen.has(next) || result.length > 100_000) {
      throw new Error('Azure DevOps project pagination did not advance.')
    }
    seen.add(next)
    continuationToken = next
  } while (continuationToken)
  return result
}

async function verify(read: Reader): Promise<AzureDevOpsConnection['viewer']> {
  const data = await read(
    '/_apis/connectionData',
    z.object({
      authenticatedUser: z.object({
        id: z.string().uuid(),
        providerDisplayName: z.string(),
        isActive: z.boolean().optional()
      })
    })
  )
  const user = data.authenticatedUser
  if (
    user.id === '00000000-0000-0000-0000-000000000000' ||
    user.isActive === false ||
    /anonymous/i.test(user.providerDisplayName)
  ) {
    throw new Error('Azure DevOps did not verify an authenticated viewer.')
  }
  try {
    await projects(read)
  } catch (error) {
    throw new Error(
      `Project discovery requires Project and Team Read access. ${error instanceof Error ? error.message : ''}`
    )
  }
  return { id: user.id, displayName: user.providerDisplayName }
}

export const azureDevOpsStatus = azureDevOpsConnectionStatus
export const azureDevOpsDisconnect = disconnectAzureDevOpsConnection
export async function azureDevOpsConnect(args: { baseUrl: string; label: string; token: string }) {
  const baseUrl = normalizeAzureDevOpsCollectionUrl(args.baseUrl)
  const token = args.token.trim()
  if (
    !token ||
    Array.from(token).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
  ) {
    throw new Error('A valid personal access token is required.')
  }
  const authorization = `Basic ${Buffer.from(`:${token}`).toString('base64')}`
  const viewer = await verify(reader(baseUrl, authorization))
  return publishAzureDevOpsConnection(
    { baseUrl, label: args.label.trim() || baseUrl, viewer },
    token
  )
}
export function azureDevOpsTestConnection(args: { connectionId: string; revision: string }) {
  return withAzureDevOpsRead(args.connectionId, args.revision, undefined, (connection, signal) =>
    verify(authorizedReader(connection, signal))
  )
}

function readSelection<T>(
  args: AzureDevOpsSelection,
  signal: AbortSignal | undefined,
  action: (read: Reader, connection: AzureDevOpsConnection) => Promise<T>
) {
  return withAzureDevOpsRead(args.connectionId, args.revision, signal, (connection, readSignal) =>
    action(authorizedReader(connection, readSignal), connection)
  )
}
export function azureDevOpsListProjects(
  args: { connectionId: string; revision: string },
  signal?: AbortSignal
) {
  return withAzureDevOpsRead(args.connectionId, args.revision, signal, (connection, readSignal) =>
    projects(authorizedReader(connection, readSignal))
  )
}
async function selectedProject(read: Reader, id: string): Promise<AzureDevOpsProject> {
  const project = await read(`/_apis/projects/${segment(id)}`, projectSchema)
  if (project.id.toLowerCase() !== id.toLowerCase()) {
    throw new Error('Azure DevOps returned a different project identity.')
  }
  return project
}
export function azureDevOpsListTeams(args: AzureDevOpsSelection, signal?: AbortSignal) {
  return readSelection(args, signal, async (read) => {
    const result: AzureDevOpsProject[] = []
    const seen = new Set<string>()
    for (let skip = 0; skip < 100_000; skip += 100) {
      const page = await read(
        `/_apis/projects/${segment(args.projectId)}/teams`,
        collection(projectSchema),
        { searchParams: { $top: 100, $skip: skip } }
      )
      if (page.value.some((team) => seen.has(team.id))) {
        throw new Error('Azure DevOps team pagination did not advance.')
      }
      for (const team of page.value) {
        seen.add(team.id)
      }
      result.push(...page.value)
      if (page.value.length < 100) {
        return result
      }
    }
    throw new Error('Azure DevOps team pagination exceeded the limit.')
  })
}
export function azureDevOpsListQueries(
  args: AzureDevOpsSelection & { folderId?: string },
  signal?: AbortSignal
): Promise<AzureDevOpsQuery[]> {
  return readSelection(args, signal, async (read) => {
    const path = `/${segment(args.projectId)}/_apis/wit/queries`
    if (!args.folderId) {
      return (await read(path, collection(querySchema), { searchParams: { $depth: 1 } })).value
    }
    const folder = await read(
      `${path}/${segment(args.folderId)}`,
      z.object({ children: z.array(querySchema).optional() }),
      { searchParams: { $depth: 1 } }
    )
    return folder.children ?? []
  })
}
export function azureDevOpsMetadata(
  args: AzureDevOpsSelection,
  signal?: AbortSignal
): Promise<AzureDevOpsMetadata> {
  return readSelection(args, signal, async (read) => {
    const path = `/${segment(args.projectId)}/_apis/wit/workitemtypes`
    const types = await read(path, collection(z.object({ name: z.string() })))
    const states = new Set<string>()
    for (const type of types.value) {
      const result = await read(
        `${path}/${segment(type.name)}/states`,
        collection(z.object({ name: z.string() }))
      )
      for (const state of result.value) {
        states.add(state.name)
      }
    }
    return { types: types.value.map((type) => type.name), states: [...states] }
  })
}
export function azureDevOpsQueryWorkItems(
  args: AzureDevOpsWorkItemQuery,
  signal?: AbortSignal
): Promise<AzureDevOpsWorkItemResults> {
  return readSelection(args, signal, async (read, connection) => {
    const project = await selectedProject(read, args.projectId)
    const prefix = `/${segment(project.id)}/${args.teamId ? `${segment(args.teamId)}/` : ''}_apis/wit`
    const result = await read(
      `${prefix}/wiql${args.queryId ? `/${segment(args.queryId)}` : ''}`,
      z.object({
        queryType: z.string(),
        workItems: z.array(z.object({ id: z.number().int().positive() })).optional()
      }),
      {
        searchParams: { $top: 201 },
        ...(args.queryId ? {} : { body: { query: azureDevOpsWiql(args, project.name) } })
      }
    )
    if (result.queryType !== 'flat') {
      throw new Error(
        'Hierarchical and linked queries are unsupported. Open this query in Azure DevOps.'
      )
    }
    if (!result.workItems) {
      throw new Error('Azure DevOps returned a malformed flat query.')
    }
    const ids = result.workItems.slice(0, 200).map((item) => item.id)
    if (!ids.length) {
      return { items: [], capped: false, omittedIds: [] }
    }
    const batch = await read(
      `/${segment(project.id)}/_apis/wit/workitemsbatch`,
      collection(workItemSchema),
      { body: { ids, fields, errorPolicy: 'Omit' } }
    )
    const items = new Map(
      batch.value.map((raw) => [raw.id, mapItem(raw, project, connection.baseUrl)])
    )
    return {
      items: ids.flatMap((id) => (items.has(id) ? [items.get(id)!] : [])),
      capped: result.workItems.length > 200,
      omittedIds: ids.filter((id) => !items.has(id))
    }
  })
}
export function azureDevOpsGetWorkItem(
  args: AzureDevOpsSelection & { id: number },
  signal?: AbortSignal
): Promise<AzureDevOpsWorkItem> {
  return readSelection(args, signal, async (read, connection) => {
    const project = await selectedProject(read, args.projectId)
    const raw = await read(
      `/${segment(project.id)}/_apis/wit/workitems/${args.id}`,
      workItemSchema,
      { searchParams: { $expand: 'relations' } }
    )
    return mapItem(raw, project, connection.baseUrl)
  })
}
