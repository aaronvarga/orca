// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { getEditorPanelRenderModel } from './editor-panel-render-model'

it('opens read-only Markdown in the built-in formatted preview without enabling plugin editors', () => {
  const model = getEditorPanelRenderModel({
    activeFile: {
      id: 'transcript',
      filePath: '/Recordings/Call.md',
      relativePath: '/Recordings/Call.md',
      worktreeId: 'project',
      language: 'markdown',
      mode: 'edit',
      isDirty: false,
      readOnly: true,
      liveTail: true
    },
    fileContents: { transcript: { content: '# Call\n\n**Speaker:** hello', isBinary: false } },
    editorDrafts: {},
    gitStatusEntries: undefined,
    gitBranchEntries: undefined,
    markdownViewMode: {},
    markdownDefaultViewMode: 'rich',
    markdownRichModeSizeOverridden: false,
    isChangesMode: false,
    canOpenWorkspaceFileBrowser: false,
    customEditors: [
      {
        key: 'colorize/editor',
        pluginKey: 'colorize',
        pluginName: 'Colorize',
        id: 'editor',
        title: 'Colorized',
        priority: 'default',
        extensions: ['.md'],
        filenames: []
      }
    ],
    customEditorChoice: 'colorize/editor'
  })
  expect(model.inlineMarkdownRenderState?.renderMode).toBe('preview')
  expect(model.activeCustomEditor).toBeNull()
  expect(model.isMarkdown).toBe(true)
})
