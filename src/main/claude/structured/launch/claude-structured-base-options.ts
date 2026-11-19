import { NATIVE_CHAT_SESSION_INSTRUCTIONS } from '../../../../shared/native-chat/input/native-chat-session-instructions'
import type { ClaudeStructuredSdkOptions } from './claude-structured-launch-resolution'

export const CLAUDE_DEFAULT_SETTING_SOURCES = ['user', 'project', 'local'] as const

/** Replay acknowledgements require an explicit flag; the SDK supplies the other transport flags. */
export const CLAUDE_STRUCTURED_BASE_OPTIONS: ClaudeStructuredSdkOptions = {
  includePartialMessages: true,
  // Keep the SDK on Claude Code's own system-prompt contract.
  systemPrompt: { type: 'preset', preset: 'claude_code', append: NATIVE_CHAT_SESSION_INSTRUCTIONS },
  hooks: {
    UserPromptSubmit: [
      {
        hooks: [
          async () => ({
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: NATIVE_CHAT_SESSION_INSTRUCTIONS
            }
          })
        ]
      }
    ]
  },
  settingSources: [...CLAUDE_DEFAULT_SETTING_SOURCES],
  supportedDialogKinds: [],
  extraArgs: { 'replay-user-messages': null }
}
