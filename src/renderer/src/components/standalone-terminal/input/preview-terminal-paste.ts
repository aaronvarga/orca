import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { pasteTerminalClipboard } from '@/components/terminal-pane/clipboard/terminal-clipboard-paste'
import { prepareTerminalComposerFiles } from '@/components/terminal-pane/composer/terminal-composer-files'
import type { TerminalPasteTextOptions } from '@/components/terminal-pane/input/paste/terminal-paste-model'
import {
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../shared/execution-host/execution-host'
import { parseRemoteRuntimePtyId } from '../../../../../shared/remote-runtime/remote-runtime-pty-id'
import type { Terminal } from '@xterm/xterm'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { executeTerminalPastePlan } from '@/components/terminal-pane/input/paste/terminal-paste-executor'
import { planTerminalPasteWithYield } from '@/components/terminal-pane/input/paste/terminal-paste-coordinator'
import { resolveTerminalPasteRuntime } from '@/components/terminal-pane/input/paste/terminal-paste-runtime'
import { pasteTerminalText } from '@/components/terminal-pane/input/paste/terminal-bracketed-paste'
import { isTerminalPanePasteFocusCurrent } from '@/components/terminal-pane/input/paste/terminal-paste-target-state'
import type { DashboardCardTerminalInput } from '../../../../../shared/agent-status/presentation/dashboard-snapshot'

export type PreviewTerminalClipboardTarget = {
  worktreeId: string
  executionHostId?: ExecutionHostId
}

export type PreviewTerminalPasteSource = 'keyboard' | 'app-menu' | 'right-click'

/** Stream bounded paste chunks through the pane coordinator, rechecking focus ownership between chunks. */
export function createPreviewClipboardPaster(deps: {
  /** Names the session for paste planning; a remote-runtime pty id routes as remote. */
  clipboardTarget?: PreviewTerminalClipboardTarget
  ptyId: string
  /** Where pasted bytes go when they bypass xterm, e.g. a bracketed paste's closing marker. */
  writeInput: (data: string) => boolean | Promise<boolean>
  container: HTMLElement
  getTerminal: () => Terminal | null
  getTerminalInput: () => DashboardCardTerminalInput | null
  isDisposed: () => boolean
}): (activeElementAtDispatch: Element | null, source: PreviewTerminalPasteSource) => Promise<void> {
  return async (activeElementAtDispatch, source) => {
    const pasteTerminal = deps.getTerminal()
    if (!pasteTerminal) {
      return
    }
    const targetIsCurrent = (): boolean =>
      !deps.isDisposed() &&
      deps.getTerminal() === pasteTerminal &&
      activeElementAtDispatch !== null &&
      isTerminalPanePasteFocusCurrent({
        requireSameFocusedElement: true,
        activeElementAtDispatch,
        paneContainer: deps.container
      })
    if (!targetIsCurrent()) {
      return
    }
    const terminalInput = deps.getTerminalInput()
    const platform = terminalInput?.hostPlatform ?? getShortcutPlatform()
    const pasteText = async (
      text: string,
      options?: TerminalPasteTextOptions
    ): Promise<boolean> => {
      const plan = await planTerminalPasteWithYield({
        text,
        source,
        target: {
          kind: 'terminal',
          paneId: 0,
          leafId: deps.ptyId,
          ptyId: deps.ptyId,
          runtime: resolveTerminalPasteRuntime({ platform, ptyId: deps.ptyId })
        },
        forceBracketedPaste: options?.forceBracketedPaste,
        forceBracketedPasteForMultiline:
          options?.forceBracketedPasteForMultiline ??
          terminalInput?.forceBracketedMultilineTextPaste,
        windowsInputRecordNewline:
          options?.windowsInputRecordNewline ?? terminalInput?.windowsInputRecordPasteNewline,
        terminalBracketedPasteMode: pasteTerminal.modes.bracketedPasteMode
      })
      const result = await executeTerminalPastePlan(plan, {
        pasteText: (text, options) => pasteTerminalText(pasteTerminal, text, options),
        writePty: (data) => deps.writeInput(data),
        isTargetCurrent: targetIsCurrent,
        // Why: if focus changes mid-bracketed paste, the closing marker must still reach the live PTY.
        canContinue: () => true
      })
      return result.status === 'pasted'
    }
    const target = deps.clipboardTarget
    const hostId = target?.executionHostId
    const copiedFiles =
      target && hostId
        ? {
            readPaths: window.api.ui.readClipboardFilePaths,
            hasImage: window.api.ui.clipboardHasImage,
            paste: async (paths: string[]) => {
              const files = await prepareTerminalComposerFiles(
                { worktreeId: target.worktreeId, executionHostId: hostId },
                paths
              )
              for (const file of files) {
                if (
                  !targetIsCurrent() ||
                  !(await pasteText(`${file.text} `, { forceBracketedPaste: true }))
                ) {
                  return
                }
              }
            }
          }
        : undefined
    const host = parseExecutionHostId(hostId)
    try {
      await pasteTerminalClipboard({
        readClipboardText: window.api.ui.readClipboardText,
        saveClipboardImageAsTempFile: () =>
          window.api.ui.saveClipboardImageAsTempFile({
            runtimeEnvironmentId: parseRemoteRuntimePtyId(deps.ptyId)?.environmentId,
            connectionId: host?.kind === 'ssh' ? host.targetId : undefined
          }),
        copiedFiles,
        pasteText,
        protectedMultilineTextPasteOptions: {
          forceBracketedPasteForMultiline: terminalInput?.forceBracketedMultilineTextPaste,
          windowsInputRecordNewline: terminalInput?.windowsInputRecordPasteNewline
        },
        onImagePasteError: () =>
          toast.error(
            translate('components.native-chat.composer.imagePasteFailed', 'Image paste failed.')
          ),
        onTextPasteError: () =>
          toast.error(translate('terminalComposer.clipboardPasteFailed', 'Clipboard paste failed.'))
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }
}
