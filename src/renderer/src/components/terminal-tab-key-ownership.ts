import { useAppStore } from '@/store'
import {
  isEventTargetInsideFloatingWorkspacePanel,
  isFloatingWorkspacePanelFocused
} from './floating-terminal/workspace/floating-workspace-terminal-actions'

export function ignoreTabKeys(target: EventTarget | null): boolean {
  if (target instanceof Element && target.closest('[data-shortcut-recorder-active]')) {
    return true
  }
  return useAppStore.getState().activeView === 'command-center' && !floatingOwnsKeys(target)
}

export function floatingOwnsKeys(target: EventTarget | null): boolean {
  return isEventTargetInsideFloatingWorkspacePanel(target) || isFloatingWorkspacePanelFocused()
}
