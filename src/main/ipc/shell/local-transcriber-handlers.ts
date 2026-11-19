import { ipcMain } from 'electron'
import { prepareLocalTranscriberRecording } from '../../integrations/local-transcriber/local-transcriber'

export function registerLocalTranscriberHandlers(): void {
  ipcMain.handle('shell:startTranscriberRecording', () => prepareLocalTranscriberRecording())
}
