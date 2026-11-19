import { useAppStore } from '@/store'
import { detectLanguage } from '../../../../../shared/editor-language/editor-language-detect'
import type { MarkdownViewMode } from '@/store/slices/editor/types/open-file'
import {
  resolveCustomEditorChoice,
  useCustomEditorViewStore,
  type ActivePluginCustomEditor,
  type CustomEditorViewChoice
} from '@/store/plugins/file-editors/plugin-custom-editors'
import {
  isCustomEditorToggleValue,
  type CustomEditorToggleValue,
  type EditorToggleValue
} from './EditorViewToggle'

const CUSTOM_EDITOR_TOGGLE_PREFIX = 'plugin-editor:'

export function customEditorToggleValue(
  editor: Pick<ActivePluginCustomEditor, 'key'>
): CustomEditorToggleValue {
  return `${CUSTOM_EDITOR_TOGGLE_PREFIX}${editor.key}`
}

export function customEditorKeyOfToggle(value: CustomEditorToggleValue): string {
  return value.slice(CUSTOM_EDITOR_TOGGLE_PREFIX.length)
}

export type CustomEditorToggle = {
  editors: readonly ActivePluginCustomEditor[]
  /** The editor shown, or null for Source. */
  active: ActivePluginCustomEditor | null
  modes: readonly EditorToggleValue[]
}

/** Editors first, then the file's own Source/Changes modes; null when no editor applies. */
export function resolveCustomEditorToggle({
  editors,
  choice,
  eligible,
  sourceModes
}: {
  editors: readonly ActivePluginCustomEditor[]
  choice: CustomEditorViewChoice | undefined
  eligible: boolean
  sourceModes: readonly EditorToggleValue[]
}): CustomEditorToggle | null {
  if (!eligible || editors.length === 0) {
    return null
  }
  return {
    editors,
    active: resolveCustomEditorChoice(editors, choice),
    modes: [
      ...editors.map(customEditorToggleValue),
      // Markdown, CSV and notebooks keep their own view modes as the non-plugin choices.
      ...(sourceModes.some((mode) => mode !== 'changes')
        ? sourceModes
        : ['edit' as const, ...sourceModes])
    ]
  }
}

/** Records a pick of a custom editor, or of Source beside one; returns any markdown mode left to apply. */
export function applyCustomEditorToggle(
  fileId: string,
  next: Exclude<EditorToggleValue, 'changes'>,
  hasCustomEditors: boolean
): MarkdownViewMode | null {
  const state = useAppStore.getState()
  const file = state.openFiles.find((entry) => entry.id === fileId)
  if (file?.mode === 'edit' && detectLanguage(file.filePath) === 'markdown') {
    if (isCustomEditorToggleValue(next)) {
      void state.updateSettings({ markdownDefaultCustomEditor: customEditorKeyOfToggle(next) })
    } else if (next === 'source' || next === 'rich') {
      state.setMarkdownDefaultViewMode(next)
    }
  }
  const { setChoice } = useCustomEditorViewStore.getState()
  if (isCustomEditorToggleValue(next)) {
    setChoice(fileId, customEditorKeyOfToggle(next))
    return null
  }
  if (hasCustomEditors) {
    setChoice(fileId, 'source')
  }
  return next === 'edit' ? null : next
}
