import { runTerminalPtyInputTransaction } from '../input/paste/terminal-pty-input-transaction'
import { planTerminalPasteWithYield } from '../input/paste/terminal-paste-coordinator'
import { executeTerminalPastePlan } from '../input/paste/terminal-paste-executor'
import type {
  TerminalPasteRuntime,
  TerminalPasteTextOptions
} from '../input/paste/terminal-paste-model'
import { AGENT_PROMPT_POST_PASTE_SUBMIT_DELAY_MS } from '../../../../../shared/agent-launch/startup/agent-prompt-injection'

export type TerminalComposerSendResult = 'sent' | 'inserted' | 'submit-failed' | 'paste-failed'

export async function sendTerminalComposerText(args: {
  text: string
  submit: boolean
  ptyId: string
  runtime: TerminalPasteRuntime
  bracketedPasteMode: boolean
  pasteOptions?: TerminalPasteTextOptions
  isCurrent: () => boolean
  write: (data: string, signal?: AbortSignal) => boolean | Promise<boolean>
}): Promise<TerminalComposerSendResult> {
  return runTerminalPtyInputTransaction(`composer:${args.ptyId}`, async () => {
    const plan = await planTerminalPasteWithYield({
      text: args.text,
      source: 'programmatic',
      target: {
        kind: 'terminal',
        paneId: 0,
        leafId: args.ptyId,
        ptyId: args.ptyId,
        runtime: args.runtime
      },
      terminalBracketedPasteMode: args.bracketedPasteMode,
      ...args.pasteOptions,
      maxDirectBytes: 0
    })
    // A composer needs acknowledged delivery even for a short paste before it clears its draft.
    const result = await executeTerminalPastePlan(
      plan.mode === 'reject' ? plan : { ...plan, mode: 'chunked' },
      {
        pasteText: () => {},
        writePty: args.write,
        isTargetCurrent: args.isCurrent,
        canContinue: args.isCurrent
      }
    )
    if (result.status !== 'pasted') {
      return 'paste-failed'
    }
    if (!args.submit) {
      return 'inserted'
    }
    await new Promise((resolve) => setTimeout(resolve, AGENT_PROMPT_POST_PASTE_SUBMIT_DELAY_MS))
    if (!args.isCurrent()) {
      return 'submit-failed'
    }
    try {
      return (await args.write('\r')) ? 'sent' : 'submit-failed'
    } catch {
      return 'submit-failed'
    }
  })
}
