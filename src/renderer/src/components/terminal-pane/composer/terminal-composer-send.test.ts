import { describe, expect, it } from 'vitest'
import { sendTerminalComposerText } from './terminal-composer-send'

const runtime = { platform: 'darwin' as const, runtimeKey: 'local:darwin', kind: 'local' as const }

describe('terminal composer delivery', () => {
  it('pastes multiline text as one framed draft before submitting', async () => {
    const bytes: string[] = []
    const result = await sendTerminalComposerText({
      text: 'first\nsecond',
      submit: true,
      ptyId: 'composer-multiline',
      runtime,
      bracketedPasteMode: true,
      isCurrent: () => true,
      write: async (data) => {
        bytes.push(data)
        return true
      }
    })
    expect(result).toBe('sent')
    expect(bytes).toEqual(['\x1b[200~', 'first\rsecond', '\x1b[201~', '\r'])
  })

  it('does not submit text when insertion alone was requested', async () => {
    const bytes: string[] = []
    expect(
      await sendTerminalComposerText({
        text: 'draft',
        submit: false,
        ptyId: 'composer-insert',
        runtime,
        bracketedPasteMode: true,
        isCurrent: () => true,
        write: (data) => {
          bytes.push(data)
          return true
        }
      })
    ).toBe('inserted')
    expect(bytes).toEqual(['\x1b[200~', 'draft', '\x1b[201~'])
  })

  it('does not send to a replaced session or submit a refused paste', async () => {
    const bytes: string[] = []
    expect(
      await sendTerminalComposerText({
        text: 'draft',
        submit: true,
        ptyId: 'composer-stale',
        runtime,
        bracketedPasteMode: true,
        isCurrent: () => false,
        write: (data) => {
          bytes.push(data)
          return true
        }
      })
    ).toBe('paste-failed')
    expect(bytes).toEqual([])
    expect(
      await sendTerminalComposerText({
        text: 'draft',
        submit: true,
        ptyId: 'composer-refused',
        runtime,
        bracketedPasteMode: true,
        isCurrent: () => true,
        write: (data) => {
          bytes.push(data)
          return false
        }
      })
    ).toBe('paste-failed')
    expect(bytes).toEqual(['\x1b[200~'])
  })

  it('reports pasted text separately when Enter is refused', async () => {
    expect(
      await sendTerminalComposerText({
        text: 'draft',
        submit: true,
        ptyId: 'composer-submit-refused',
        runtime,
        bracketedPasteMode: true,
        isCurrent: () => true,
        write: (data) => data !== '\r'
      })
    ).toBe('submit-failed')
  })
})
