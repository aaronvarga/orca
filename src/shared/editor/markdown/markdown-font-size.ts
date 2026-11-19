import { computeEditorFontSize } from '../editor-font-zoom'

export function resolveMarkdownFontSize(value: number | undefined): number {
  return computeEditorFontSize(typeof value === 'number' && Number.isFinite(value) ? value : 14, 0)
}
