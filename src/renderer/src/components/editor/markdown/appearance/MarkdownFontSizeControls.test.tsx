import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { MarkdownFontSizeControls } from './MarkdownFontSizeControls'

const original = useAppStore.getState()
afterEach(() => {
  cleanup()
  useAppStore.setState(original)
  vi.unstubAllGlobals()
})

it('writes the Markdown preference and restores its displayed value on remount', async () => {
  const save = vi.fn(async (patch: Partial<GlobalSettings>) =>
    useAppStore.setState((state) => ({ settings: { ...state.settings!, ...patch } }))
  )
  useAppStore.setState({
    settings: { ...getDefaultSettings('/test'), markdownFontSize: 17 },
    updateSettingsOrThrow: save
  })
  const view = () =>
    render(
      <TooltipProvider>
        <MarkdownFontSizeControls />
      </TooltipProvider>
    )
  const first = view()
  await userEvent.click(screen.getByRole('button', { name: 'Increase Markdown text size' }))
  expect(save).toHaveBeenCalledWith({ markdownFontSize: 18 })
  first.unmount()
  view()
  expect(screen.getByText('18 px')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Decrease Markdown text size' }))
  expect(save).toHaveBeenLastCalledWith({ markdownFontSize: 17 })
})

it('uses an active Markdown plugin’s own saved font-size setting', async () => {
  const setSetting = vi.fn(async () => ({ ok: true }))
  vi.stubGlobal('api', {
    plugins: {
      getSettings: async () => ({
        settings: [{ key: 'fontSize', type: 'integer', minimum: 11, maximum: 28 }],
        values: { fontSize: 19 }
      }),
      setSetting
    }
  })
  render(
    <TooltipProvider>
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
    </TooltipProvider>
  )
  const increase = await screen.findByRole('button', { name: 'Increase Markdown text size' })
  await userEvent.click(increase)
  await waitFor(() =>
    expect(setSetting).toHaveBeenCalledWith({ pluginKey: 'colorize', key: 'fontSize', value: 20 })
  )
  expect(await screen.findByText('20 px')).toBeInTheDocument()
})
