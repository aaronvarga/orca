import { useEffect, useState, type CSSProperties } from 'react'
import { clampFloatingTerminalBounds } from '@/components/floating-terminal/geometry/floating-terminal-panel-bounds'
import {
  useWorkspacePanePresentation,
  workspacePanePresentationKey
} from './workspace-pane-presentation'

export function usePanePresentationStyle(worktreeId: string, groupId: string, visible: boolean) {
  const key = workspacePanePresentationKey(worktreeId, groupId)
  const presentation = useWorkspacePanePresentation((state) => state.panes[key])
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  useEffect(() => () => useWorkspacePanePresentation.getState().set(key, null), [key])
  useEffect(() => {
    if (!element || !presentation?.floating || presentation.maximized) {
      return
    }
    const observer = new ResizeObserver(() => {
      const store = useWorkspacePanePresentation.getState()
      const current = store.panes[key]
      if (!current?.floating || current.maximized) {
        return
      }
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return
      }
      if (
        Math.abs(rect.width - current.bounds.width) > 1 ||
        Math.abs(rect.height - current.bounds.height) > 1
      ) {
        store.set(key, {
          ...current,
          bounds: { ...current.bounds, width: rect.width, height: rect.height }
        })
      }
    })
    observer.observe(element)
    const resize = () => {
      const store = useWorkspacePanePresentation.getState()
      const current = store.panes[key]
      if (current) {
        store.set(key, { ...current, bounds: clampFloatingTerminalBounds(current.bounds) })
      }
    }
    window.addEventListener('resize', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [element, key, presentation?.floating, presentation?.maximized])
  const style: CSSProperties | undefined = !presentation
    ? undefined
    : presentation.maximized
      ? {
          position: 'fixed',
          zIndex: 45,
          left: 12,
          right: 12,
          top: 36,
          bottom: 36,
          opacity: 1,
          visibility: visible ? 'visible' : 'hidden'
        }
      : {
          position: 'fixed',
          zIndex: 45,
          ...clampFloatingTerminalBounds(presentation.bounds),
          resize: 'both',
          opacity: 1,
          visibility: visible ? 'visible' : 'hidden'
        }
  return { floating: !!presentation, setElement, style }
}
