import { create } from 'zustand'
import {
  getDefaultFloatingTerminalBounds,
  type FloatingTerminalPanelBounds
} from '@/components/floating-terminal/geometry/floating-terminal-panel-bounds'

export type WorkspacePanePresentation = {
  floating: boolean
  maximized: boolean
  bounds: FloatingTerminalPanelBounds
}
export const useWorkspacePanePresentation = create<{
  panes: Record<string, WorkspacePanePresentation>
  set: (key: string, value: WorkspacePanePresentation | null) => void
}>((set) => ({
  panes: {},
  set: (key, value) =>
    set((state) => {
      const panes = { ...state.panes }
      if (value) {
        panes[key] = value
      } else {
        delete panes[key]
      }
      return { panes }
    })
}))
export function workspacePanePresentationKey(worktreeId: string, groupId: string): string {
  return JSON.stringify([worktreeId, groupId])
}
export function toggleWorkspacePanePresentation(key: string, action: 'float' | 'maximize'): void {
  const store = useWorkspacePanePresentation.getState()
  const previous = store.panes[key] ?? {
    floating: false,
    maximized: false,
    bounds: getDefaultFloatingTerminalBounds()
  }
  const next =
    action === 'float'
      ? { ...previous, floating: !previous.floating, maximized: false }
      : { ...previous, maximized: !previous.maximized }
  store.set(key, next.floating || next.maximized ? next : null)
}
