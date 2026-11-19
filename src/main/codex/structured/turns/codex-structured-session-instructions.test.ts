import { expect, it } from 'vitest'
import { injectCodexSessionInstructions } from './codex-structured-session-instructions'

it('delivers reminders as developer context to the owning thread without changing input or execution settings', async () => {
  let delivered: unknown
  let method: string | undefined
  await injectCodexSessionInstructions(
    {
      request: async (name, params) => {
        method = name
        delivered = params
        return {}
      }
    },
    'owned-thread'
  )
  expect(method).toBe('thread/inject_items')
  expect(delivered).toEqual({
    threadId: 'owned-thread',
    items: [
      {
        type: 'message',
        role: 'developer',
        content: [{ type: 'input_text', text: expect.any(String) }]
      }
    ]
  })
})
