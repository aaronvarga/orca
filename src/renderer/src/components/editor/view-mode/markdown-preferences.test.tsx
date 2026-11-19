// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { renderHook, cleanup, render, screen, fireEvent } from '@testing-library/react'
import { useAppStore } from '@/store'
import {
  useCustomEditorViewStore,
  useFileCustomEditors
} from '@/store/plugins/file-editors/plugin-custom-editors'
import { getDefaultSettings } from '../../../../../shared/orca-profiles/constants'
import { MarkdownTableOfContentsPanel } from '../markdown/navigation/MarkdownTableOfContentsPanel'
import { applyCustomEditorToggle } from './custom-editor-toggle'

const original = useAppStore.getState()
const originalChoices = useCustomEditorViewStore.getState()
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  useAppStore.setState(original)
  useCustomEditorViewStore.setState(originalChoices)
})

it('saves outline and frontmatter preferences when enabled and disabled', () => {
  const save = vi.fn(async () => {})
  useAppStore.setState({ updateSettings: save })
  const state = useAppStore.getState()
  state.setMarkdownTableOfContentsVisible('notes.md', true)
  expect(save).toHaveBeenLastCalledWith({ markdownOutlineVisible: true })
  state.setMarkdownTableOfContentsVisible('notes.md', false)
  expect(save).toHaveBeenLastCalledWith({ markdownOutlineVisible: false })
  state.setMarkdownFrontmatterVisible('notes.md', false)
  expect(save).toHaveBeenLastCalledWith({ markdownFrontmatterDefaultVisible: false })
  state.setMarkdownFrontmatterVisible('notes.md', true)
  expect(save).toHaveBeenLastCalledWith({ markdownFrontmatterDefaultVisible: true })
})

it('remembers explicit Markdown view picks and restores a saved plugin choice', () => {
  const save = vi.fn(async () => {})
  useAppStore.setState({
    updateSettings: save,
    settings: getDefaultSettings('/test'),
    openFiles: [
      {
        id: 'notes',
        filePath: '/repo/notes.md',
        relativePath: 'notes.md',
        worktreeId: 'repo',
        language: 'markdown',
        mode: 'edit',
        isDirty: false
      }
    ]
  })
  applyCustomEditorToggle('notes', 'source', true)
  expect(save).toHaveBeenLastCalledWith({
    markdownDefaultViewMode: 'source',
    markdownDefaultCustomEditor: 'source'
  })
  applyCustomEditorToggle('notes', 'rich', true)
  expect(save).toHaveBeenLastCalledWith({
    markdownDefaultViewMode: 'rich',
    markdownDefaultCustomEditor: 'source'
  })
  applyCustomEditorToggle('notes', 'plugin-editor:colorize/editor', true)
  expect(save).toHaveBeenLastCalledWith({ markdownDefaultCustomEditor: 'colorize/editor' })

  useCustomEditorViewStore.setState({ choices: {} })
  useAppStore.setState({
    settings: { ...getDefaultSettings('/test'), markdownDefaultCustomEditor: 'colorize/editor' }
  })
  const reopened = renderHook(() => useFileCustomEditors('reopened', '/repo/notes.md'))
  expect(reopened.result.current.customEditorChoice).toBe('colorize/editor')
})

it('restores outline depth when headings arrive and saves a changed depth', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  const save = vi.fn(async () => {})
  useAppStore.setState({
    updateSettings: save,
    settings: { ...getDefaultSettings('/test'), markdownOutlineLevel: 1 }
  })
  const props = { onClose: () => {}, onNavigate: () => {} }
  const view = render(<MarkdownTableOfContentsPanel {...props} items={[]} />)
  view.rerender(
    <MarkdownTableOfContentsPanel
      {...props}
      items={[
        {
          id: 'title',
          title: 'Title',
          level: 1,
          children: [{ id: 'section', title: 'Section', level: 2, children: [] }]
        }
      ]}
    />
  )
  expect(screen.queryByRole('button', { name: 'Section' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand all heading levels' }))
  expect(screen.getByRole('button', { name: 'Section' })).toBeTruthy()
  expect(save).toHaveBeenCalledWith({ markdownOutlineLevel: 5 })
})
