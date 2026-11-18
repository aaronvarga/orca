import { parentPort, workerData } from 'node:worker_threads'
import { writeCredentialFileAtomic } from './integration-credential-file'
import { installWorkerSendLedger } from '../worker-threads/worker-send-ledger'

installWorkerSendLedger('orca-credential-file-write')

const { path, data }: { path: string; data: Uint8Array } = workerData
writeCredentialFileAtomic(path, Buffer.from(data))
parentPort!.postMessage(true)
