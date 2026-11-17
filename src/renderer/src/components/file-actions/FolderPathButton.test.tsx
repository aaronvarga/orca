// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FolderPathButton } from './FolderPathButton'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
const originalApi = window.api
const container = document.createElement('div')
const root = createRoot(container)
afterEach(() => {
  act(() => root.render(null))
  window.api = originalApi
})

it('opens the exact folder in the OS, and never sends a remote twin to the local OS', async () => {
  const openFilePath = vi.fn().mockResolvedValue(true)
  window.api = { ...originalApi, shell: { ...originalApi?.shell, openFilePath } }
  const render = (owner: 'local' | 'runtime:server') =>
    act(() =>
      root.render(
        <TooltipProvider>
          <FolderPathButton path="/projects/orca" owner={owner} />
        </TooltipProvider>
      )
    )
  render('local')
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(openFilePath.mock.calls).toEqual([['/projects/orca', 'local']])
  render('runtime:server')
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(openFilePath.mock.calls).toEqual([['/projects/orca', 'local']])
})
