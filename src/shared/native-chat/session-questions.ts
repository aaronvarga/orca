import type { NativeChatMessage } from './native-chat-types'
import { parseAskFromToolInput } from './input/native-chat-ask'
import {
  askAnswerQuote,
  isDeliveredNativeChatUserMessage
} from './input/questions/native-chat-ask-answer'
import { nativeChatAskScanOrder } from './input/questions/native-chat-ask-order'
import { parseCodexAsyncQuestionReply } from './input/questions/codex-async-question-reply'
import { CODEX_ASYNC_QUESTION_TOOL } from './input/questions/codex-async-question-input'
import { isAskUserQuestionTool } from '../agent-status/lifecycle/agent-question-answered-intent'
import { agentSessionPromptQuestions } from '../agent-session/requests/prompts/agent-session-question-answer'
import {
  nativeChatReceiptAnswers,
  type NativeChatResolvedPrompt
} from './input/questions/native-chat-resolution-receipt'
import { pairToolBlocks } from './tools/native-chat-tool-pairs'

export type SessionQuestion = {
  id: string
  question: string
  answer: string | null
  state: 'pending' | 'resolved' | 'cancelled'
}

/** Read recorded answers, never infer them from the next ordinary user message. */
export function collectSessionQuestions(
  messages: readonly NativeChatMessage[],
  receipts: ReadonlyMap<string, NativeChatResolvedPrompt>
): SessionQuestion[] {
  const entries: SessionQuestion[] = []
  const seenReceipts = new Set<string>()
  const seenCalls = new Set<string>()
  const asyncCalls = new Map<string, SessionQuestion[]>()
  const messageReplies: SessionQuestion[] = []
  const results = new Map(
    pairToolBlocks(messages.flatMap((message) => message.blocks)).flatMap(({ call, result }) =>
      call ? [[call, result] as const] : []
    )
  )
  const addReceipt = (id: string, body: NativeChatResolvedPrompt): void => {
    if (body.kind !== 'question' || seenReceipts.has(id)) {
      return
    }
    seenReceipts.add(id)
    const answers = nativeChatReceiptAnswers(body)
    agentSessionPromptQuestions(body).forEach((question, index) =>
      entries.push({
        id: `receipt:${id}:${index}`,
        question: question.question,
        answer: answers[index]?.answer ?? null,
        state: body.resolution.state
      })
    )
  }
  for (const message of nativeChatAskScanOrder(messages)) {
    const receipt = receipts.get(message.id)
    if (receipt) {
      addReceipt(message.id, receipt)
    }
    for (const [slot, block] of message.blocks.entries()) {
      if (
        block.type !== 'tool-call' ||
        (!isAskUserQuestionTool(block.name) && block.name !== CODEX_ASYNC_QUESTION_TOOL)
      ) {
        continue
      }
      const id = block.callId ?? `${message.id}:${slot}`
      if (seenCalls.has(id)) {
        continue
      }
      seenCalls.add(id)
      const prompt = parseAskFromToolInput(block.name, block.input)
      if (!prompt) {
        continue
      }
      const rows = prompt.questions.map((question, index): SessionQuestion => ({
        id: `tool:${id}:${index}`,
        question: question.question,
        answer: null,
        state: block.state === 'failed' || results.get(block)?.isError ? 'cancelled' : 'pending'
      }))
      entries.push(...rows)
      if (prompt.replyAsMessage) {
        asyncCalls.set(id, rows)
        messageReplies.push(...rows)
      }
    }
    if (!isDeliveredNativeChatUserMessage(message)) {
      continue
    }
    const text = message.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
    const replies = parseCodexAsyncQuestionReply(text)
    if (replies !== null) {
      for (const reply of replies) {
        const row = asyncCalls.get(reply.callId)?.[reply.index]
        if (row && reply.answer !== undefined) {
          row.answer = reply.answer
          row.state = 'resolved'
        }
      }
      continue
    }
    const quoted = messageReplies
      .filter((row) => row.state === 'pending')
      .flatMap((row) => {
        const quote = askAnswerQuote({ question: row.question, options: [], multiSelect: false })
        const index = text.indexOf(quote)
        return index !== -1 && (index === 0 || text.slice(index - 2, index) === '\n\n')
          ? [{ row, index, start: index + quote.length }]
          : []
      })
      .sort((a, b) => a.index - b.index)
    quoted.forEach(({ row, start }, index) => {
      const answer = text.slice(start, quoted[index + 1]?.index ?? text.length).trim()
      if (answer) {
        row.answer = answer
        row.state = 'resolved'
      }
    })
  }
  for (const [id, body] of receipts) {
    addReceipt(id, body)
  }
  return entries
}
