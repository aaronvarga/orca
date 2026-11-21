import { CODEX_ASYNC_QUESTION_TOOL } from './codex-async-question-input'

const REPLY_OPEN = '<send_user_message_question_reply>'
const REPLY_CLOSE = '</send_user_message_question_reply>'

type CodexAsyncQuestionReply = { callId: string; index: number; answer?: string }

/** Null for an ordinary message; malformed reply envelopes contain no trusted answers. */
export function parseCodexAsyncQuestionReply(text: string): CodexAsyncQuestionReply[] | null {
  const body = text.trim()
  if (!body.startsWith(REPLY_OPEN) || !body.endsWith(REPLY_CLOSE)) {
    return null
  }
  try {
    const items: unknown = JSON.parse(body.slice(REPLY_OPEN.length, -REPLY_CLOSE.length))
    if (!Array.isArray(items)) {
      return []
    }
    return items.flatMap((item): CodexAsyncQuestionReply[] => {
      if (!item || typeof item !== 'object' || typeof item.questionItemId !== 'string') {
        return []
      }
      let id: unknown
      try {
        id = JSON.parse(item.questionItemId)
      } catch {
        return []
      }
      return Array.isArray(id) &&
        id[0] === CODEX_ASYNC_QUESTION_TOOL &&
        typeof id[1] === 'string' &&
        Number.isInteger(id[2]) &&
        id[2] >= 0
        ? [
            {
              callId: id[1],
              index: id[2],
              ...(typeof item.answer === 'string' ? { answer: item.answer } : {})
            }
          ]
        : []
    })
  } catch {
    return []
  }
}
