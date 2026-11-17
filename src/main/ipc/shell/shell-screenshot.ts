import { ipcMain, app } from 'electron'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'

export function registerShellScreenshotHandler(): void {
  ipcMain.handle('shell:captureScreenshot', async (): Promise<string | null> => {
    if (process.platform !== 'darwin') {
      throw new Error('Interactive screenshots are available on macOS.')
    }
    const directory = await mkdtemp(join(app.getPath('temp'), 'orca-screenshot-'))
    const path = join(directory, 'Screenshot.png')
    try {
      const result = await runProcess({
        program: '/usr/sbin/screencapture',
        args: ['-i', '-s', path],
        timeoutMs: null
      })
      if (result.code !== 0 || !(await stat(path).catch(() => null))?.isFile()) {
        await rm(directory, { recursive: true, force: true })
        return null
      }
      return path
    } catch (error) {
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  })
}
