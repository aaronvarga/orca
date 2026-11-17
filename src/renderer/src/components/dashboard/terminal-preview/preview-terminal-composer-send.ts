import type { Terminal } from '@xterm/xterm'
import type { DashboardCardTerminalInput } from '../../../../../shared/agent-status/presentation/dashboard-snapshot'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { resolveTerminalPasteRuntime } from '../../terminal-pane/input/paste/terminal-paste-runtime'
import { sendTerminalComposerText } from '../../terminal-pane/composer/terminal-composer-send'

export function createPreviewTerminalComposerSend(deps: {
  ptyId: string
  getTerminal: () => Terminal | null
  getConnection: () => object | null
  getInput: () => DashboardCardTerminalInput | null
  isAvailable: () => boolean
  write: (data: string) => boolean | Promise<boolean>
}) {
  return async (text: string, submit: boolean) => {
    const terminal = deps.getTerminal()
    const connection = deps.getConnection()
    const isCurrent = () =>
      deps.isAvailable() &&
      terminal === deps.getTerminal() &&
      connection !== null &&
      deps.getConnection() === connection
    if (!terminal || !isCurrent()) {
      return 'paste-failed' as const
    }
    const input = deps.getInput()
    const platform = input?.hostPlatform ?? getShortcutPlatform()
    return sendTerminalComposerText({
      text,
      submit,
      ptyId: deps.ptyId,
      runtime: resolveTerminalPasteRuntime({ platform, ptyId: deps.ptyId }),
      bracketedPasteMode: terminal.modes.bracketedPasteMode,
      pasteOptions: {
        forceBracketedPasteForMultiline: input?.forceBracketedMultilineTextPaste,
        windowsInputRecordNewline: input?.windowsInputRecordPasteNewline
      },
      isCurrent,
      write: (data) => (isCurrent() ? deps.write(data) : false)
    })
  }
}
