import { readFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { fileStatSignature } from '../filesystem/file-stat-signature'
import type { IntegrationCredentialService } from '../../shared/secure-storage/integration-credential-errors'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken
} from './integration-credential-file'
import {
  createIntegrationStateFileCache,
  type IntegrationStateFileCache
} from './integration-state-file-cache'

type TokenFileState = { present: boolean; token?: string; error?: string }
const MAX_CREDENTIAL_ENTRIES = 128

export function createIntegrationTokenFileCache(args: {
  service: IntegrationCredentialService
  filePath: (id: string) => string
}) {
  const entries = new Map<string, IntegrationStateFileCache<TokenFileState>>()
  const stateFor = (id: string): TokenFileState => {
    let entry = entries.get(id)
    if (!entry) {
      entry = createIntegrationStateFileCache<TokenFileState>({
        filePath: () => args.filePath(id),
        readFromDisk: () => ({ present: credentialFileHasContent(args.filePath(id)) })
      })
    }
    entries.delete(id)
    entries.set(id, entry)
    while (entries.size > MAX_CREDENTIAL_ENTRIES) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      entries.delete(oldest)
    }
    return entry.get()
  }
  return {
    has(id: string): boolean {
      return stateFor(id).present
    },
    read(id: string, force = true): string | null {
      // Stamp before decrypting so a concurrent rotation cannot pin older bytes as current.
      const state = stateFor(id)
      if (state.token !== undefined) {
        return state.token
      }
      if (!force || !state.present) {
        return null
      }
      try {
        const token = readStoredCredentialToken(args.service, readFileSync(args.filePath(id)))
        state.token = token ?? undefined
        state.error = undefined
        return token
      } catch (error) {
        if (error instanceof CredentialDecryptionError) {
          state.error = error.message
          throw error
        }
        return null
      }
    },
    error(id: string): string | undefined {
      return stateFor(id).error
    },
    forget(id: string): void {
      entries.delete(id)
    },
    clear(): void {
      entries.clear()
    }
  }
}

export function createAsyncIntegrationTokenFileCache(args: {
  service: IntegrationCredentialService
  filePath: (id: string) => string
}) {
  type Entry = TokenFileState & { stamp: string | null; pending?: Promise<string | null> }
  const entries = new Map<string, Entry>()
  const stateFor = async (id: string): Promise<Entry> => {
    const path = args.filePath(id)
    const info = await stat(path, { bigint: true }).catch(() => null)
    const stamp = info ? `${path}:${fileStatSignature(info)}` : null
    let state = entries.get(id)
    if (!state || state.stamp !== stamp) {
      state = { stamp, present: info !== null && info.size > 0n }
    }
    entries.delete(id)
    entries.set(id, state)
    while (entries.size > MAX_CREDENTIAL_ENTRIES) {
      entries.delete(entries.keys().next().value!)
    }
    return state
  }
  return {
    async has(id: string): Promise<boolean> {
      return (await stateFor(id)).present
    },
    async error(id: string): Promise<string | undefined> {
      return (await stateFor(id)).error
    },
    async read(id: string): Promise<string | null> {
      const state = await stateFor(id)
      if (state.token !== undefined) {
        return state.token
      }
      if (!state.present) {
        return null
      }
      state.pending ??= (async () => {
        try {
          const token = readStoredCredentialToken(args.service, await readFile(args.filePath(id)))
          state.token = token ?? undefined
          state.error = undefined
          return token
        } catch (error) {
          if (error instanceof CredentialDecryptionError) {
            state.error = error.message
            throw error
          }
          return null
        } finally {
          delete state.pending
        }
      })()
      return state.pending
    },
    forget(id: string): void {
      entries.delete(id)
    }
  }
}
