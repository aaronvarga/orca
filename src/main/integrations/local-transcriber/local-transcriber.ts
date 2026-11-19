import { runProcess } from '@orca/process-host'
import { stat } from 'node:fs/promises'
import { dirname, extname, isAbsolute } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { z } from 'zod'
import type { LocalTranscriberRecording } from '../../../shared/integrations/local-transcriber'

const statusSchema = z.object({
  recording: z.boolean(),
  status: z.string(),
  file: z.string()
})

async function command(script: string): Promise<string> {
  const result = await runProcess({
    program: '/usr/bin/osascript',
    args: ['-e', `tell application id "com.jestrada.Transcriber" to ${script}`],
    timeoutMs: 10_000
  })
  if (result.code !== 0) {
    throw new Error(
      'Could not control Local Transcriber. Check that it is installed and allow Orca to control it in macOS Automation settings.'
    )
  }
  return result.stdout.trim()
}

async function recordingStatus(): Promise<z.infer<typeof statusSchema>> {
  return statusSchema.parse(JSON.parse(await command('get status')))
}

let pending: Promise<LocalTranscriberRecording> | undefined

/** One start at a time: repeated clicks must never interrupt or create duplicate recordings. */
export function prepareLocalTranscriberRecording(): Promise<LocalTranscriberRecording> {
  if (process.platform !== 'darwin') {
    return Promise.reject(new Error('Local Transcriber is available on macOS only.'))
  }
  if (!pending) {
    pending = prepareRecording().finally(() => {
      pending = undefined
    })
  }
  return pending
}

async function prepareRecording(): Promise<LocalTranscriberRecording> {
  const opened = await runProcess({
    program: '/usr/bin/open',
    args: ['-g', '-b', 'com.jestrada.Transcriber'],
    timeoutMs: 10_000
  })
  if (opened.code !== 0) {
    throw new Error('Install Local Transcriber on this Mac before starting a recording session.')
  }
  const previous = await recordingStatus()
  const reused = previous.recording
  if (!reused) {
    await command('start recording')
  }
  const deadline = Date.now() + 30_000
  do {
    const current = await recordingStatus()
    const filePath = current.file
    if (
      current.recording &&
      (reused || filePath !== previous.file) &&
      isAbsolute(filePath) &&
      extname(filePath).toLowerCase() === '.md' &&
      (await stat(filePath).catch(() => null))?.isFile()
    ) {
      return {
        filePath,
        directory: dirname(filePath),
        reused,
        paused: current.status.toLowerCase() === 'paused'
      }
    }
    await setTimeout(500)
  } while (Date.now() < deadline)
  throw new Error(
    'Local Transcriber did not produce a new Markdown recording. Check its microphone permissions, model download, and recording status, then try again.'
  )
}
