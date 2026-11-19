import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { MarkdownFontSizeControls } from './MarkdownFontSizeControls'
import { useAppStore } from '@/store'

export const toolbar = defineFixture({
  width: 480,
  render: () => (
    <div className="flex h-9 items-center justify-end bg-card px-2 text-card-foreground">
      <MarkdownFontSizeControls />
    </div>
  )
})

export const plugin = defineFixture({
  ...toolbar,
  setup: () => {
    window.api.plugins.getSettings = async () => ({
      settings: [
        {
          key: 'fontSize',
          title: 'Text size',
          type: 'integer',
          minimum: 11,
          maximum: 28,
          default: 15
        }
      ],
      values: { fontSize: 19 }
    })
  },
  render: () => (
    <div className="flex h-9 items-center justify-end bg-card px-2 text-card-foreground">
      <MarkdownFontSizeControls
        customEditor={{
          key: 'colorize/editor',
          pluginKey: 'colorize',
          pluginName: 'Colorize',
          id: 'editor',
          title: 'Colorized',
          extensions: ['.md'],
          filenames: [],
          priority: 'option'
        }}
      />
    </div>
  )
})

export const larger = defineFixture({
  ...toolbar,
  setup: () => {
    const state = useAppStore.getState()
    if (state.settings) {
      useAppStore.setState({ settings: { ...state.settings, markdownFontSize: 20 } })
    }
  }
})
