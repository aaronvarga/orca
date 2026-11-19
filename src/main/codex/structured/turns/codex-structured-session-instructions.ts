import type { CodexAppServerConnection } from '../../app-server/codex-app-server-connection-types'
import { isCodexMethodNotFoundError } from '../../app-server/codex-app-server-session'
import { NATIVE_CHAT_SESSION_INSTRUCTIONS } from '../../../../shared/native-chat/input/native-chat-session-instructions'

const unsupported = new WeakSet<object>()

/** Developer context adds no turn and preserves user text, configured instructions and collaboration mode. */
export async function injectCodexSessionInstructions(
  connection: Pick<CodexAppServerConnection, 'request'>,
  threadId: string
): Promise<void> {
  if (unsupported.has(connection)) {
    return
  }
  try {
    await connection.request(
      'thread/inject_items',
      {
        threadId,
        items: [
          {
            type: 'message',
            role: 'developer',
            content: [{ type: 'input_text', text: NATIVE_CHAT_SESSION_INSTRUCTIONS }]
          }
        ]
      },
      { timeoutMs: 2_000 }
    )
  } catch (error) {
    if (isCodexMethodNotFoundError(error)) {
      unsupported.add(connection)
    }
    console.warn('[codex-session] Could not deliver session instructions', error)
  }
}
