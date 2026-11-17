import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { normalizeAzureDevOpsCollectionUrl } from '../../shared/azure-devops/connection-url'
import type {
  AzureDevOpsConnection,
  AzureDevOpsStatus
} from '../../shared/azure-devops/boards-types'
import {
  writeEncryptedCredential,
  writeCredentialFileAtomic
} from '../credentials/integration-credential-file'
import { createIntegrationStateFileCache } from '../credentials/integration-state-file-cache'
import { createIntegrationTokenFileCache } from '../credentials/integration-token-file-cache'
import { readCredentialFileProtection } from '../credentials/credential-file-protection'

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
const tokens = createIntegrationTokenFileCache({ service: 'Azure DevOps', filePath: tokenPath })
const registry = createIntegrationStateFileCache({
  filePath: registryPath,
  readFromDisk: (): AzureDevOpsConnection[] => {
    if (!existsSync(registryPath())) {
      return []
    }
    return z.array(connectionSchema).parse(JSON.parse(readFileSync(registryPath(), 'utf8')))
  }
})
let environmentSnapshot: {
  token: string
  authorizationKey: string
  connection: AzureDevOpsConnection
} | null = null
function environmentConnection(): AzureDevOpsConnection | null {
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
    if (savedAzureDevOpsConnections().some((entry) => entry.baseUrl === baseUrl)) {
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
export function azureDevOpsConnections(): AzureDevOpsConnection[] {
  const environment = environmentConnection()
  return [...savedAzureDevOpsConnections(), ...(environment ? [environment] : [])]
}

const reads = new Map<string, Set<AbortController>>()

export function savedAzureDevOpsConnections(): AzureDevOpsConnection[] {
  return registry.get()
}

export function azureDevOpsConnectionStatus(): AzureDevOpsStatus {
  const connections = azureDevOpsConnections()
  return {
    connections,
    credentialProtection: connections.some(
      (entry) => readCredentialFileProtection(tokenPath(entry.revision)) === 'plaintext'
    )
      ? 'plaintext'
      : null,
    credentialError: connections
      .map((entry) =>
        entry.externallyManaged
          ? undefined
          : (tokens.error(entry.revision) ??
            (!tokens.has(entry.revision)
              ? 'Saved Azure DevOps credential is unavailable. Reconnect this organization.'
              : undefined))
      )
      .find(Boolean)
  }
}

function invalidateReads(id: string, revision?: string): void {
  for (const controller of reads.get(id) ?? []) {
    controller.abort()
  }
  reads.delete(id)
  tokens.forget(revision ?? id)
}

function writeRegistry(connections: AzureDevOpsConnection[]): void {
  mkdirSync(directory(), { recursive: true, mode: 0o700 })
  writeCredentialFileAtomic(registryPath(), Buffer.from(JSON.stringify(connections)))
  registry.invalidate()
}

export function publishAzureDevOpsConnection(
  input: Omit<AzureDevOpsConnection, 'id' | 'revision'>,
  token: string
): AzureDevOpsConnection {
  const connections = savedAzureDevOpsConnections()
  const previous = connections.find((entry) => entry.baseUrl === input.baseUrl)
  const connection = { ...input, id: previous?.id ?? randomUUID(), revision: randomUUID() }
  mkdirSync(directory(), { recursive: true, mode: 0o700 })
  writeEncryptedCredential('Azure DevOps', tokenPath(connection.revision), token)
  try {
    writeRegistry([...connections.filter((entry) => entry.id !== connection.id), connection])
  } catch (error) {
    unlinkSync(tokenPath(connection.revision))
    throw error
  }
  invalidateReads(connection.id, previous?.revision)
  if (previous && existsSync(tokenPath(previous.revision))) {
    try {
      unlinkSync(tokenPath(previous.revision))
    } catch {
      /* Published metadata already selects the new credential. */
    }
  }
  return connection
}

export function disconnectAzureDevOpsConnection(id: string): void {
  if (id === 'environment') {
    throw new Error(
      'Change the Azure DevOps environment variables on this host to disconnect this connection.'
    )
  }
  const connections = savedAzureDevOpsConnections()
  writeRegistry(connections.filter((entry) => entry.id !== id))
  const previous = connections.find((entry) => entry.id === id)
  invalidateReads(id, previous?.revision)
  if (previous && existsSync(tokenPath(previous.revision))) {
    unlinkSync(tokenPath(previous.revision))
  }
}

export function savedAzureDevOpsToken(connection: AzureDevOpsConnection): string {
  if (connection.externallyManaged) {
    const current = environmentConnection()
    if (!current || current.revision !== connection.revision || !environmentSnapshot) {
      throw new Error('Environment credential changed. Refresh the connection.')
    }
    return environmentSnapshot.token
  }
  const token = tokens.read(connection.revision)
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
  const connection = azureDevOpsConnections().find((entry) => entry.id === connectionId)
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
      azureDevOpsConnections().find((entry) => entry.id === connectionId)?.revision !== revision
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
