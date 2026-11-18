import type * as WorkerEntryPath from '../worker-threads/worker-thread-entry-path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { afterAll, beforeAll, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ path: '' }))
vi.mock('../worker-threads/worker-thread-entry-path', async (original) => ({
  ...(await original<typeof WorkerEntryPath>()),
  resolveWorkerThreadEntryPath: () => fixture.path
}))

let directory: string
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'orca-credential-writer-'))
  fixture.path = join(directory, 'credential-file-write-worker-entry.cjs')
  await build({
    entryPoints: [join(__dirname, 'credential-file-write-worker-entry.ts')],
    outfile: fixture.path,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent'
  })
})
afterAll(() => rm(directory, { recursive: true, force: true }))
