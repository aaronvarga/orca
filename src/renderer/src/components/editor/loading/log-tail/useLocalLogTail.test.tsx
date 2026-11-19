// @vitest-environment happy-dom
import { useState } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { FileContent } from '../editor-panel-content-types'
import type { OpenFile } from '@/store/slices/editor/types/open-file'
import type { LocalLogTailChangedPayload } from '../../../../../../shared/file-content/local-log-tail-types'
import { useLocalLogTail } from './useLocalLogTail'

const files: OpenFile[] = [
  {
    id: 'transcript',
    filePath: '/Recordings/Call.md',
    relativePath: '/Recordings/Call.md',
    worktreeId: 'project',
    language: 'markdown',
    mode: 'edit',
    isDirty: false,
    readOnly: true,
    liveTail: true,
    runtimeEnvironmentId: null
  }
]
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shows Markdown appends, same-size corrections, truncation and replacement without reopening the tab', async () => {
  let snapshot = '# Call\nFirst line'
  let identity = 'original'
  let subscriptionId = ''
  let notify: (event: LocalLogTailChangedPayload) => void = () => {}
  vi.stubGlobal('api', {
    fs: {
      onLocalLogTailChanged: (listener: typeof notify) => {
        notify = listener
        return () => {}
      },
      startLocalLogTail: async (args: { subscriptionId: string }) => {
        subscriptionId = args.subscriptionId
      },
      stopLocalLogTail: async () => {},
      readFile: async () => ({ content: snapshot, isBinary: false, fileIdentity: identity }),
      readLocalLogTail: async () => {
        throw new Error('Markdown must not use append-only reads')
      }
    }
  })
  function Transcript() {
    const [fileContents, setFileContents] = useState<Record<string, FileContent>>({
      transcript: { content: '# Call\nFirst line', isBinary: false, fileIdentity: 'original' }
    })
    useLocalLogTail({
      openFiles: files,
      fileContents,
      setFileContents,
      reloadContent: () =>
        setFileContents({
          transcript: { content: snapshot, isBinary: false, fileIdentity: identity }
        })
    })
    return <pre data-testid="transcript">{fileContents.transcript.content}</pre>
  }
  render(<Transcript />)
  await waitFor(() =>
    expect(screen.getByTestId('transcript').textContent).toBe('# Call\nFirst line')
  )
  snapshot = '# Call\nFirst line\nNew words without a newline'
  act(() => notify({ subscriptionId, eventType: 'change' }))
  await waitFor(() =>
    expect(screen.getByTestId('transcript').textContent).toBe(
      '# Call\nFirst line\nNew words without a newline'
    )
  )
  snapshot = '# Call\nFixed line\nNew words without a newline'
  act(() => notify({ subscriptionId, eventType: 'change' }))
  await waitFor(() =>
    expect(screen.getByTestId('transcript').textContent).toBe(
      '# Call\nFixed line\nNew words without a newline'
    )
  )
  snapshot = '# Short'
  act(() => notify({ subscriptionId, eventType: 'change' }))
  await waitFor(() => expect(screen.getByTestId('transcript').textContent).toBe('# Short'))
  snapshot = '# Replaced\nFinal corrected transcript'
  identity = 'replacement'
  act(() => notify({ subscriptionId, eventType: 'rename' }))
  await waitFor(() =>
    expect(screen.getByTestId('transcript').textContent).toBe(
      '# Replaced\nFinal corrected transcript'
    )
  )
})
