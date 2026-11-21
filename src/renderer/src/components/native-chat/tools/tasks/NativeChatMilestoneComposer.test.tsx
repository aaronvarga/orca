// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TranslationScopeProvider } from '@/i18n/translation-scope-provider'
import {
  NativeChatMilestoneToggle,
  NativeChatMilestoneVisibilityProvider
} from './NativeChatMilestoneVisibility'
import {
  NativeChatMilestoneComposerSlot,
  NativeChatMilestoneLayout
} from './NativeChatMilestoneLayout'

type PreferenceStore = {
  settings: GlobalSettings
  updateSettingsOrThrow: (updates: Partial<GlobalSettings>) => Promise<void>
}
const mocks = vi.hoisted(() => {
  const state: { preferences: UseBoundStore<StoreApi<PreferenceStore>> | null } = {
    preferences: null
  }
  return state
})
vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const { getDefaultSettings } = await import('../../../../../../shared/orca-profiles/constants')
  const preferences = create<PreferenceStore>((set) => ({
    settings: getDefaultSettings('/test-home'),
    updateSettingsOrThrow: async (updates) =>
      set((state) => ({ settings: { ...state.settings, ...updates } }))
  }))
  mocks.preferences = preferences
  return { useAppStore: preferences }
})

afterEach(cleanup)

function Pane({ withoutMilestones = false }: { withoutMilestones?: boolean }) {
  return (
    <TranslationScopeProvider>
      <TooltipProvider>
        <NativeChatMilestoneVisibilityProvider sessionId="conversation">
          <NativeChatMilestoneLayout
            sessionId="conversation"
            messages={[]}
            enabled
            working={false}
            milestones={
              withoutMilestones
                ? undefined
                : {
                    tasks: [
                      { id: 'first', content: 'Review the implementation', status: 'in_progress' }
                    ]
                  }
            }
          >
            <div>Transcript</div>
          </NativeChatMilestoneLayout>
          <div data-composer>
            <NativeChatMilestoneComposerSlot enabled milestonesAvailable={!withoutMilestones} />
            <NativeChatMilestoneToggle />
          </div>
        </NativeChatMilestoneVisibilityProvider>
      </TooltipProvider>
    </TranslationScopeProvider>
  )
}

it('attaches progress to the composer and restores its disclosure and selected view after remount', async () => {
  const first = render(<Pane />)
  const header = first.container.querySelector<HTMLButtonElement>(
    '[data-native-chat-milestone-panel] button[aria-expanded]'
  )!
  expect(header.closest('[data-composer]')).not.toBeNull()
  expect(header).toHaveAttribute('aria-expanded', 'false')
  await act(async () => fireEvent.click(header))
  const agents = screen.getByRole('tab', { name: /Agents/ })
  await act(async () => fireEvent.mouseDown(agents, { button: 0, ctrlKey: false }))
  await waitFor(() =>
    expect(mocks.preferences!.getState().settings.nativeChatMilestonePanels).toEqual({
      conversation: { shown: true, expanded: true, view: 'agents', dock: 'bottom' }
    })
  )
  first.unmount()
  const restored = render(<Pane />)
  expect(
    restored.container.querySelector('[data-native-chat-milestone-panel] button[aria-expanded]')
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('tab', { name: /Agents/ })).toHaveAttribute('aria-selected', 'true')
})

it('restores right docking after remount and can return milestones to the composer', async () => {
  const first = render(<Pane />)
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Move milestones to the right' }))
  )
  expect(first.container.querySelector('aside [data-native-chat-milestone-panel]')).not.toBeNull()
  await waitFor(() =>
    expect(
      mocks.preferences!.getState().settings.nativeChatMilestonePanels?.conversation?.dock
    ).toBe('right')
  )
  first.unmount()
  const restored = render(<Pane />)
  const side = restored.container.querySelector('aside')!
  expect(side.querySelector('[data-native-chat-milestone-panel]')).not.toBeNull()
  await act(async () =>
    fireEvent.click(side.querySelector('button[aria-label="Move milestones to the bottom"]')!)
  )
  expect(restored.container.querySelector('aside')).toBeNull()
  expect(
    restored.container.querySelector('[data-composer] [data-native-chat-milestone-panel]')
  ).not.toBeNull()
  await waitFor(() =>
    expect(
      mocks.preferences!.getState().settings.nativeChatMilestonePanels?.conversation?.dock
    ).toBe('bottom')
  )
})

it('opens and restores files directly even before milestones exist', async () => {
  mocks.preferences!.setState((state) => ({
    settings: { ...state.settings, nativeChatMilestonePanels: {} }
  }))
  const first = render(<Pane withoutMilestones />)
  expect(first.container.querySelector('[data-native-chat-session-resources]')).toBeNull()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Output' })))
  expect(
    first.container.querySelector('[data-composer] [data-native-chat-session-resources]')
  ).not.toBeNull()
  await waitFor(() =>
    expect(mocks.preferences!.getState().settings.nativeChatMilestonePanels?.conversation).toEqual({
      shown: true,
      expanded: true,
      view: 'resources',
      dock: 'bottom'
    })
  )
  first.unmount()
  const restored = render(<Pane withoutMilestones />)
  expect(
    restored.container.querySelector('[data-composer] [data-native-chat-session-resources]')
  ).not.toBeNull()
  expect(screen.getByRole('tab', { name: /Output/ })).toHaveAttribute('aria-selected', 'true')
})

it('remembers Q&A without milestones and keeps it attached after reopening', async () => {
  mocks.preferences!.setState((state) => ({
    settings: { ...state.settings, nativeChatMilestonePanels: {} }
  }))
  const first = render(<Pane withoutMilestones />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Output' })))
  await act(async () =>
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Q&A/ }), { button: 0, ctrlKey: false })
  )
  first.unmount()
  const restored = render(<Pane withoutMilestones />)
  expect(screen.getByRole('tab', { name: /Q&A/ })).toHaveAttribute('aria-selected', 'true')
  expect(
    restored.container.querySelector('[data-composer] [data-native-chat-session-questions]')
  ).not.toBeNull()
})
