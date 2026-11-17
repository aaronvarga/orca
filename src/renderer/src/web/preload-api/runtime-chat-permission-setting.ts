import { isAgentChatPermissionMode } from '../../../../shared/agent-launch/permissions/agent-chat-permission-mode'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'

/** The host's new-chat permission default (the host seeds from it), kept only when a known mode. */
export function runtimeChatPermissionSetting(
  settings: Partial<GlobalSettings>,
  _includeAgentOverrides = true
): Pick<GlobalSettings, 'nativeChatPermissionMode'> {
  return isAgentChatPermissionMode(settings.nativeChatPermissionMode)
    ? { nativeChatPermissionMode: settings.nativeChatPermissionMode }
    : {}
}
