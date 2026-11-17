import {
  useCallback,
  useEffect,
  useEffectEvent,
  type ClipboardEventHandler,
  type RefObject
} from 'react'
import { APP_MENU_PASTE_EVENT } from '@/lib/clipboard/menu/app-menu-paste'
import { pasteTextIntoTextControl } from '@/lib/text-input/paste/text-control-paste'
import { isWebClientLocation } from '@/app-shell/platform/web-client-location'
import { pasteTerminalClipboard } from '../clipboard/terminal-clipboard-paste'

export function useTerminalComposerPaste({
  inputRef,
  disabled,
  onAttach,
  onError
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>
  disabled: boolean
  onAttach: (paths: string[]) => Promise<void>
  onError: (error: string) => void
}): ClipboardEventHandler<HTMLTextAreaElement> {
  const reportError = useCallback(
    (error: unknown) => onError(error instanceof Error ? error.message : String(error)),
    [onError]
  )
  const pasteClipboard = useEffectEvent(async () => {
    const input = inputRef.current
    if (!input || disabled || input.disabled) {
      return
    }
    const current = () =>
      inputRef.current === input && input.isConnected && document.activeElement === input
    await pasteTerminalClipboard({
      readClipboardText: window.api.ui.readClipboardText,
      saveClipboardImageAsTempFile: () => window.api.ui.saveClipboardImageAsTempFile(),
      copiedFiles: {
        readPaths: window.api.ui.readClipboardFilePaths,
        hasImage: window.api.ui.clipboardHasImage,
        paste: async (paths) => {
          if (current()) {
            await onAttach(paths)
          }
        }
      },
      pasteText: async (text, options) => {
        if (!current()) {
          return false
        }
        if (options?.forceBracketedPaste) {
          await onAttach([text])
          return true
        }
        return (
          (
            await pasteTextIntoTextControl(input, text, {
              source: 'app-menu',
              canContinue: current
            })
          ).status === 'pasted'
        )
      },
      onTextPasteError: reportError,
      onImagePasteError: reportError
    })
  })
  useEffect(() => {
    const paste = (event: Event) => {
      if (event.defaultPrevented || document.activeElement !== inputRef.current) {
        return
      }
      event.preventDefault()
      void pasteClipboard().catch(reportError)
    }
    window.addEventListener(APP_MENU_PASTE_EVENT, paste)
    return () => window.removeEventListener(APP_MENU_PASTE_EVENT, paste)
  }, [inputRef, reportError])
  return (event) => {
    const image = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith('image/')
    )
    if (!image || disabled) {
      return
    }
    event.preventDefault()
    const input = event.currentTarget
    const text = event.clipboardData.getData('text/plain')
    void (async () => {
      if (text) {
        await pasteTextIntoTextControl(input, text, {
          source: 'clipboard',
          canContinue: () => inputRef.current === input
        })
      }
      const path = await window.api.ui.saveClipboardImageAsTempFile(
        isWebClientLocation() ? { eventImage: image } : undefined
      )
      if (path && inputRef.current === input) {
        await onAttach([path])
      }
    })().catch(reportError)
  }
}
