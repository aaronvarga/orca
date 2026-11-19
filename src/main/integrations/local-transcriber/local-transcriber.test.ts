import { afterEach, expect, it, vi } from 'vitest'
import { prepareLocalTranscriberRecording } from './local-transcriber'
import { runProcess } from '@orca/process-host'
import { stat } from 'node:fs/promises'
import { statSync } from 'node:fs'

vi.mock('@orca/process-host', () => ({ runProcess: vi.fn() }))
vi.mock('node:fs/promises', () => ({ stat: vi.fn() }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('uses the active app-reported file and preserves an already paused recording', async () => {
  vi.stubGlobal('process', { ...process, platform: 'darwin' })
  vi.mocked(stat).mockResolvedValue(statSync(process.execPath))
  vi.mocked(runProcess).mockImplementation(async (options) => {
    if (options.program === '/usr/bin/open') {
      return { code: 0, stdout: '', stderr: '', signal: null, timedOut: false }
    }
    const script = options.args?.join(' ') ?? ''
    if (!script.endsWith('get status')) {
      throw new Error('Must not change an existing recording')
    }
    return {
      code: 0,
      stdout: JSON.stringify({
        recording: true,
        status: 'Paused',
        file: '/Recordings/Client Call.md'
      }),
      stderr: '',
      signal: null,
      timedOut: false
    }
  })
  expect(await prepareLocalTranscriberRecording()).toEqual({
    filePath: '/Recordings/Client Call.md',
    directory: '/Recordings',
    reused: true,
    paused: true
  })
})

it('starts an idle app and binds the new file instead of its previous transcript', async () => {
  vi.stubGlobal('process', { ...process, platform: 'darwin' })
  vi.mocked(stat).mockResolvedValue(statSync(process.execPath))
  let recording = false
  vi.mocked(runProcess).mockImplementation(async (options) => {
    const script = options.args?.join(' ') ?? ''
    if (script.endsWith('start recording')) {
      recording = true
    }
    return {
      code: 0,
      stdout:
        options.program === '/usr/bin/osascript' && script.endsWith('get status')
          ? JSON.stringify({
              recording,
              status: recording ? 'Transcribing…' : 'Ready',
              file: recording ? '/Recordings/New Call.md' : '/Recordings/Old Call.md'
            })
          : '',
      stderr: '',
      signal: null,
      timedOut: false
    }
  })
  expect(await prepareLocalTranscriberRecording()).toEqual({
    filePath: '/Recordings/New Call.md',
    directory: '/Recordings',
    reused: false,
    paused: false
  })
})

it('refuses recording on platforms without Local Transcriber', async () => {
  vi.stubGlobal('process', { ...process, platform: 'linux' })
  await expect(prepareLocalTranscriberRecording()).rejects.toThrow('macOS only')
})
