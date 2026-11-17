import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { ITheme } from '@xterm/xterm'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'
import { composeActiveTerminalTheme } from '@/components/terminal-pane/appearance/terminal-appearance'
import { resolveEffectiveTerminalAppearance } from '@/lib/terminal/appearance/terminal-theme'

export function useTerminalPreviewAppearance(
  settings: GlobalSettings | null,
  systemPrefersDark: boolean
) {
  const { terminalTheme: composedTheme, terminalMode } = useMemo(() => {
    if (!settings) {
      return { terminalTheme: null, terminalMode: 'dark' as const }
    }
    const appearance = resolveEffectiveTerminalAppearance(settings, systemPrefersDark)
    const theme = composeActiveTerminalTheme(appearance.theme, settings)
    return { terminalTheme: theme, terminalMode: appearance.mode }
  }, [settings, systemPrefersDark])
  // Settings arrive as cloned snapshots; compare theme values before reconnecting.
  const retainTheme = useShallow((theme: ITheme | null) => theme)
  const terminalTheme = retainTheme(composedTheme)
  return { terminalTheme, terminalMode }
}
