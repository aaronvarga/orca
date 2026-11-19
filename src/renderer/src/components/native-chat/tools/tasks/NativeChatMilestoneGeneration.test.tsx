// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { TranslationScopeProvider } from '@/i18n/translation-scope-provider'
import {
  NativeChatMilestoneGeneration,
  NativeChatMilestoneGenerationContext
} from './NativeChatMilestoneGeneration'

afterEach(cleanup)

it('allows generation during main-agent work and retries a failed background job', async () => {
  let finish: ((result: { applied: boolean }) => void) | undefined
  let failed = true
  render(
    <TranslationScopeProvider>
      <NativeChatMilestoneGenerationContext
        value={{
          regenerateMilestones: () => {
            if (failed) {
              failed = false
              return Promise.reject(new Error('offline'))
            }
            return new Promise((resolve) => {
              finish = resolve
            })
          }
        }}
      >
        <NativeChatMilestoneGeneration working />
      </NativeChatMilestoneGenerationContext>
    </TranslationScopeProvider>
  )
  await act(async () => fireEvent.click(screen.getByRole('button')))
  expect(screen.getByRole('status')).toBeVisible()
  expect(screen.getByRole('button')).toBeEnabled()
  await act(async () => fireEvent.click(screen.getByRole('button')))
  expect(screen.getByRole('button')).toBeDisabled()
  await act(async () => finish?.({ applied: false }))
  expect(screen.getByRole('status')).toBeVisible()
  expect(screen.getByRole('button')).toBeEnabled()
})
