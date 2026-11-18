import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { normalizeAzureDevOpsCollectionUrl } from '../../shared/azure-devops/connection-url'
import type {
  AzureDevOpsConnection,
  AzureDevOpsStatus
} from '../../shared/azure-devops/boards-types'
import { encodeStoredCredentialToken } from '../credentials/integration-credential-file'
import { writeCredentialFile } from '../credentials/credential-file-write'
import { createAsyncIntegrationTokenFileCache } from '../credentials/integration-token-file-cache'
import { classifyUnenvelopedCredential } from '../../shared/secure-storage/secret-at-rest-protection'

const connectionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  baseUrl: z.string().transform(normalizeAzureDevOpsCollectionUrl),
  viewer: z.object({ id: z.string().min(1), displayName: z.string() }),
  revision: z.string().uuid()
})
const directory = () => join(homedir(), '.orca', 'azure-devops')
const registryPath = () => join(directory(), 'connections.json')
const tokenPath = (id: string) => join(directory(), `${Buffer.from(id).toString('base64url')}.enc`)
const tokens = createAsyncIntegrationTokenFileCache({
  service: 'Azure DevOps',
  filePath: tokenPath
})
let environmentSnapshot: {
  token: string
  authorizationKey: string
  connection: AzureDevOpsConnection
} | null = null
async function environmentConnection(): Promise<AzureDevOpsConnection | null> {
  const accessToken = process.env.ORCA_AZURE_DEVOPS_ACCESS_TOKEN?.trim()
  const token =
    accessToken ||
    process.env.ORCA_AZURE_DEVOPS_TOKEN?.trim() ||
    process.env.ORCA_AZURE_DEVOPS_PAT?.trim()
  const authorizationKey = JSON.stringify([
    accessToken ? 'bearer' : 'basic',
    accessToken ? null : process.env.ORCA_AZURE_DEVOPS_USERNAME?.trim(),
    token
  ])
  const base = process.env.ORCA_AZURE_DEVOPS_API_BASE_URL?.trim()
  if (!token || !base) {
    return null
  }
  try {
    const baseUrl = normalizeAzureDevOpsCollectionUrl(base)
    if ((await savedAzureDevOpsConnections()).some((entry) => entry.baseUrl === baseUrl)) {
      return null
    }
    if (
      environmentSnapshot?.authorizationKey !== authorizationKey ||
      environmentSnapshot.connection.baseUrl !== baseUrl
    ) {
      environmentSnapshot = {
        token,
        authorizationKey,
        connection: {
          id: 'environment',
          label: 'Environment',
          baseUrl,
          viewer: { id: 'environment', displayName: 'Externally managed credential' },
          revision: randomUUID(),
          externallyManaged: true
        }
      }
    }
    return environmentSnapshot.connection
  } catch {
    return null
  }
}
export async function azureDevOpsConnections(): Promise<AzureDevOpsConnection[]> {
  const environment = await environmentConnection()
  return [...(await savedAzureDevOpsConnections()), ...(environment ? [environment] : [])]
}

const reads = new Map<string, Set<AbortController>>()

export async function savedAzureDevOpsConnections(): Promise<AzureDevOpsConnection[]> {
  try {
    return z.array(connectionSchema).parse(JSON.parse(await readFile(registryPath(), 'utf8')))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export async function azureDevOpsConnectionStatus(): Promise<AzureDevOpsStatus> {
  const connections = await azureDevOpsConnections()
  const states = await Promise.all(
    connections.map(async (entry) => {
      if (entry.externallyManaged) {
        return { protection: null, error: undefined }
      }
      const path = tokenPath(entry.revision)
      const raw = await readFile(path).catch(() => null)
      const present = await tokens.has(entry.revision)
      return {
        protection: raw?.length ? classifyUnenvelopedCredential(raw) : null,
        error:
          (await tokens.error(entry.revision)) ??
          (!present
            ? 'Saved Azure DevOps credential is unavailable. Reconnect this organization.'
            : undefined)
      }
    })
  )
  return {
    connections,
    credentialProtection: states.some((state) => state.protection === 'plaintext')
      ? 'plaintext'
      : null,
    credentialError: states.map((state) => state.error).find(Boolean)
  }
}

function invalidateReads(id: string, revision?: string): void {
  for (const controller of reads.get(id) ?? []) {
    controller.abort()
  }
  reads.delete(id)
  tokens.forget(revision ?? id)
}

async function writeRegistry(connections: AzureDevOpsConnection[]): Promise<void> {
  await mkdir(directory(), { recursive: true, mode: 0o700 })
  await writeCredentialFile(registryPath(), Buffer.from(JSON.stringify(connections)))
}

let mutations: Promise<unknown> = Promise.resolve()
function mutate<T>(action: () => Promise<T>): Promise<T> {
  const result = mutations.then(action, action)
  mutations = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export async function publishAzureDevOpsConnection(
  input: Omit<AzureDevOpsConnection, 'id' | 'revision'>,
  token: string
): Promise<AzureDevOpsConnection> {
  return mutate(async () => {
    const connections = await savedAzureDevOpsConnections()
    const previous = connections.find((entry) => entry.baseUrl === input.baseUrl)
    const connection = { ...input, id: previous?.id ?? randomUUID(), revision: randomUUID() }
    await mkdir(directory(), { recursive: true, mode: 0o700 })
    await writeCredentialFile(
      tokenPath(connection.revision),
      encodeStoredCredentialToken('Azure DevOps', token)
    )
    try {
      await writeRegistry([
        ...connections.filter((entry) => entry.id !== connection.id),
        connection
      ])
    } catch (error) {
      await unlink(tokenPath(connection.revision))
      throw error
    }
    invalidateReads(connection.id, previous?.revision)
    if (previous) {
      try {
        await unlink(tokenPath(previous.revision))
      } catch {
        /* Published metadata already selects the new credential. */
      }
    }
    return connection
  })
}

export async function disconnectAzureDevOpsConnection(id: string): Promise<void> {
  return mutate(async () => {
    if (id === 'environment') {
      throw new Error(
        'Change the Azure DevOps environment variables on this host to disconnect this connection.'
      )
    }
    const connections = await savedAzureDevOpsConnections()
    await writeRegistry(connections.filter((entry) => entry.id !== id))
    const previous = connections.find((entry) => entry.id === id)
    invalidateReads(id, previous?.revision)
    if (previous) {
      await unlink(tokenPath(previous.revision)).catch((error: unknown) => {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
          throw error
        }
      })
    }
  })
}

export async function savedAzureDevOpsToken(connection: AzureDevOpsConnection): Promise<string> {
  if (connection.externallyManaged) {
    const current = await environmentConnection()
    if (!current || current.revision !== connection.revision || !environmentSnapshot) {
      throw new Error('Environment credential changed. Refresh the connection.')
    }
    return environmentSnapshot.token
  }
  const token = await tokens.read(connection.revision)
  if (!token) {
    throw new Error('Azure DevOps credential is unavailable. Reconnect in Settings.')
  }
  return token
}

export async function withAzureDevOpsRead<T>(
  connectionId: string,
  revision: string,
  signal: AbortSignal | undefined,
  action: (connection: AzureDevOpsConnection, signal: AbortSignal) => Promise<T>
): Promise<T> {
  const connection = (await azureDevOpsConnections()).find((entry) => entry.id === connectionId)
  if (!connection || connection.revision !== revision) {
    throw new Error('Azure DevOps connection changed. Refresh and select the connection again.')
  }
  const controller = new AbortController()
  const controllers = reads.get(connectionId) ?? new Set<AbortController>()
  reads.set(connectionId, controllers)
  controllers.add(controller)
  try {
    const readSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    const result = await action(connection, readSignal)
    readSignal.throwIfAborted()
    if (
      (await azureDevOpsConnections()).find((entry) => entry.id === connectionId)?.revision !==
      revision
    ) {
      throw new Error('Azure DevOps connection changed during the read. Refresh and try again.')
    }
    return result
  } finally {
    controllers.delete(controller)
    if (!controllers.size) {
      reads.delete(connectionId)
    }
  }
}
