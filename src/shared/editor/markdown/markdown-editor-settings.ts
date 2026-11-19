export type MarkdownEditorSettings = {
  /** Persisted opt-out for browser spellcheck noise in rich Markdown editing surfaces. */
  richMarkdownSpellcheckEnabled?: boolean
  /** View newly opened Markdown files start in (see markdown-default-view-mode.ts); absent = Rich. */
  markdownDefaultViewMode?: 'source' | 'rich'
  /** Default body text size for formatted Markdown, shared by rich editing and preview. */
  markdownFontSize?: number
  /** Last explicitly selected Markdown plugin editor, or source for the built-in views. */
  markdownDefaultCustomEditor?: string
  markdownOutlineVisible?: boolean
  markdownOutlineLevel?: 1 | 2 | 3 | 4 | 5
  markdownFrontmatterDefaultVisible?: boolean
  /** Whether local markdown review note controls and the review panel are shown. */
  markdownReviewToolsEnabled: boolean
}
