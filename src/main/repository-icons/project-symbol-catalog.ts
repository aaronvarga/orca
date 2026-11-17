import { runProcess } from '@orca/process-host'
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import {
  ProjectSymbolCatalogSchema,
  type ProjectSymbolCatalog
} from '../../shared/repository/appearance/project-symbol-catalog'

const SymbolNamesSchema = z
  .array(z.string().regex(/^[a-zA-Z0-9._-]{1,128}$/))
  .min(1)
  .max(128)
const SymbolImagesSchema = z.record(
  z.string(),
  z
    .string()
    .max(32 * 1024)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/)
)
let catalog: Promise<ProjectSymbolCatalog | null> | undefined

async function helperPath(): Promise<string | null> {
  if (process.platform !== 'darwin') {
    return null
  }
  const devRoot = process.env.ORCA_DEV_REPO_ROOT
  if (devRoot) {
    const devPath = join(
      devRoot,
      'native',
      'project-symbols-macos',
      '.build',
      'release',
      'orca-project-symbols'
    )
    if (
      await stat(devPath).then(
        () => true,
        () => false
      )
    ) {
      return devPath
    }
  }
  const path = join(dirname(process.execPath), 'orca-project-symbols')
  return stat(path).then(
    () => path,
    () => null
  )
}

async function runHelper(path: string, args: string[], maxOutputBytes: number): Promise<string> {
  const result = await runProcess({
    program: path,
    args,
    timeoutMs: 10000,
    maxOutputBytes,
    killOnOutputLimit: true
  })
  if (result.code !== 0 || result.timedOut || result.signal || result.outputTruncated) {
    throw new Error('The system symbol helper did not return a complete result.')
  }
  return result.stdout
}

export async function getProjectSymbolCatalog(): Promise<ProjectSymbolCatalog | null> {
  const path = await helperPath()
  if (!path) {
    return null
  }
  return (catalog ??= runHelper(path, ['catalog'], 8 * 1024 * 1024)
    .then((stdout) => ProjectSymbolCatalogSchema.parse(JSON.parse(stdout)))
    .catch((error) => {
      catalog = undefined
      throw error
    }))
}

export async function renderProjectSymbols(input: unknown): Promise<Record<string, string>> {
  const names = SymbolNamesSchema.parse(input)
  const path = await helperPath()
  if (!path) {
    return {}
  }
  const stdout = await runHelper(path, ['render', ...names], 4 * 1024 * 1024)
  return SymbolImagesSchema.parse(JSON.parse(stdout))
}
