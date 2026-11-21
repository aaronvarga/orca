// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { setAgentSessionFavorite } from './agent-session-favorites'
import { AgentSessionFavorites } from '../session-list/AgentSessionFavorites'
import { TranslationScopeProvider } from '@/i18n/translation-scope-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

const original = useAppStore.getState()
afterEach(() => {
  cleanup()
  useAppStore.setState(original, true)
})

it('keeps favorites after the session tab closes and the sidebar remounts, until explicitly removed', async () => {
  useAppStore.setState({
    settings: getDefaultSettings('/favorites-test'),
    unifiedTabsByWorktree: {
      'folder:1': [
        {
          id: 'tab-1',
          entityId: 'chat-1',
          worktreeId: 'folder:1',
          groupId: 'group-1',
          contentType: 'agent-session',
          label: 'Review the migration',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        }
      ]
    },
    updateSettingsOrThrow: async (updates) =>
      useAppStore.setState((state) => ({ settings: { ...state.settings!, ...updates } }))
  })
  const favorite = {
    executionHostId: 'local' as const,
    agent: 'claude' as const,
    sessionId: 'chat-1',
    title: 'Review the migration',
    cwd: '/plain-folder',
    structuredSession: { sessionId: 'chat-1', workspaceId: 'folder:1' }
  }
  await setAgentSessionFavorite(favorite, true)
  const sidebar = () => (
    <TranslationScopeProvider>
      <TooltipProvider>
        <AgentSessionFavorites onOpen={vi.fn()} />
      </TooltipProvider>
    </TranslationScopeProvider>
  )
  const first = render(sidebar())
  expect(first.getByRole('button', { name: /Review the migration/ })).toBeTruthy()
  await act(async () => useAppStore.setState({ unifiedTabsByWorktree: {} }))
  first.unmount()
  const reopened = render(sidebar())
  expect(reopened.getByRole('button', { name: /Review the migration/ })).toBeTruthy()
  await act(async () => setAgentSessionFavorite(favorite, false))
  expect(reopened.queryByRole('button', { name: /Review the migration/ })).toBeNull()
})
