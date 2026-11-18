import './credential-file-write.test-fixture'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { writeCredentialFile } from './credential-file-write'

it('publishes credential bytes privately from its worker and rejects failed writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-credential-publish-'))
  try {
    const path = join(directory, 'credential.enc')
    await writeCredentialFile(path, Buffer.from('saved-credential'))
    expect(await readFile(path, 'utf8')).toBe('saved-credential')
    if (process.platform !== 'win32') {
      expect((await stat(path)).mode & 0o777).toBe(0o600)
    }
    await expect(
      writeCredentialFile(join(directory, 'missing', 'credential.enc'), Buffer.from('replacement'))
    ).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('saved-credential')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
