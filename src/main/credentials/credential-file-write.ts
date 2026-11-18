import { spawnWorkerThread } from '../worker-threads/worker-thread-spawn'
import {
  currentWorkerEntryLayout,
  resolveWorkerThreadEntryPath
} from '../worker-threads/worker-thread-entry-path'

export function writeCredentialFile(path: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = spawnWorkerThread(
      resolveWorkerThreadEntryPath(
        currentWorkerEntryLayout(__dirname),
        'credential-file-write-worker-entry.js'
      ),
      { name: 'orca-credential-file-write', workerData: { path, data } }
    )
    let published = false
    worker.once('message', () => {
      published = true
      resolve()
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (!published) {
        reject(new Error(`Credential writer exited without publishing (${code}).`))
      }
    })
  })
}
