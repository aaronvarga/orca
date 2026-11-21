import { expect, it } from 'vitest'
import type { NativeChatMessage } from './native-chat-types'
import { collectSessionResources } from './session-resources'

it('indexes successful changes and sources across messages without promoting failed calls or prose to outputs', () => {
  const messages: NativeChatMessage[] = [
    {
      id: 'calls',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        {
          type: 'tool-call',
          name: 'Write',
          callId: 'write',
          state: 'completed',
          input: { file_path: '/project/brief.md', content: 'Brief' }
        },
        {
          type: 'tool-call',
          name: 'Read',
          callId: 'read',
          input: { file_path: '/project/research.md' }
        },
        {
          type: 'tool-call',
          name: 'Write',
          callId: 'failed',
          state: 'failed',
          input: { file_path: '/project/missing.md', content: 'No' }
        },
        { type: 'text', text: 'I might write /project/speculative.md later.' }
      ]
    },
    {
      id: 'results',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        { type: 'tool-result', callId: 'write', output: 'File created.' },
        { type: 'tool-result', callId: 'read', output: 'Research' },
        { type: 'tool-result', callId: 'failed', isError: true, output: 'Permission denied' },
        {
          type: 'tool-call',
          name: 'web_search',
          state: 'completed',
          input: { url: 'https://example.com/research' },
          webSearchResults: [
            { title: 'Research source', url: 'https://example.com/research' },
            { title: 'Unsafe', url: 'javascript:alert(1)' }
          ]
        }
      ]
    },
    {
      id: 'repeat',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        {
          type: 'tool-call',
          name: 'Read',
          state: 'completed',
          input: { file_path: '/project/research.md' }
        }
      ]
    }
  ]
  const resources = collectSessionResources(messages)
  expect(resources.changedFiles.map(({ detail }) => detail)).toEqual(['/project/brief.md'])
  expect(resources.sources.map(({ detail }) => detail)).toEqual([
    '/project/research.md',
    'https://example.com/research'
  ])
  expect(resources.sources[1].label).toBe('Research source')
})

it('keeps explicit uploads separate from images viewed by the agent', () => {
  const resources = collectSessionResources([
    {
      id: 'upload',
      role: 'user',
      source: 'transcript',
      timestamp: null,
      blocks: [
        { type: 'image-ref', path: 'C:\\Meetings\\whiteboard.png' },
        {
          type: 'text',
          text: '@"/tmp/agent-session-attachments/12345678-1234-1234-1234-123456789abc/meeting notes.txt" @"/tmp/agent-session-attachments/12345678-1234-1234-1234-123456789abc/contract.pdf"'
        }
      ]
    },
    {
      id: 'viewed',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [{ type: 'image-ref', path: '/project/chart.png' }]
    }
  ])
  expect(resources.uploads.map(({ label }) => label)).toEqual([
    'whiteboard.png',
    'meeting notes.txt',
    'contract.pdf'
  ])
  expect(resources.sources.map(({ detail }) => detail)).toEqual(['/project/chart.png'])
  expect(resources.outputs).toEqual([])
})

it('uses links from a successful Claude search result without collecting speculative reply links', () => {
  const resources = collectSessionResources([
    {
      id: 'search',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        {
          type: 'tool-call',
          name: 'WebSearch',
          callId: 'search',
          input: { query: 'architecture' }
        },
        {
          type: 'tool-result',
          callId: 'search',
          output: 'Links: [{"title":"Architecture","url":"https://example.com/architecture"}]'
        },
        { type: 'text', text: 'I could also check https://example.com/unread later.' }
      ]
    }
  ])
  expect(resources.sources.map(({ href }) => href)).toEqual(['https://example.com/architecture'])
})

it('extracts actual Codex file paths from a multi-file diff instead of inventing a file-count path', () => {
  const resources = collectSessionResources([
    {
      id: 'diff',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        { type: 'tool-call', name: 'Diff', callId: 'patch', input: { path: '2 files' } },
        {
          type: 'tool-result',
          callId: 'patch',
          output:
            'diff --git a/report.md b/report.md\nnew file mode 100644\n--- /dev/null\n+++ b/report.md\n@@ -0,0 +1 @@\n+Report\ndiff --git a/data.csv b/data.csv\n--- a/data.csv\n+++ b/data.csv\n@@ -1 +1 @@\n-old\n+new'
        }
      ]
    }
  ])
  expect(resources.changedFiles.map(({ detail }) => detail)).toEqual(['report.md', 'data.csv'])
})

it('separates linked deliverables from routine edits and omits deleted outputs', () => {
  const resources = collectSessionResources([
    {
      id: 'delivery',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        ...['/repo/report.md', '/repo/src/app.ts', '/repo/docs/setup.md'].map((path, index) => ({
          type: 'tool-call' as const,
          name: 'Write',
          callId: `write-${index}`,
          state: 'completed' as const,
          input: { file_path: path, content: 'Updated' }
        })),
        { type: 'tool-call', name: 'Diff', callId: 'delete', input: { path: '2 files' } },
        {
          type: 'tool-result',
          callId: 'delete',
          output:
            'diff --git a/old.pdf b/old.pdf\ndeleted file mode 100644\n--- a/old.pdf\n+++ /dev/null\n@@ -1 +0,0 @@\n-old'
        },
        {
          type: 'text',
          text: '[Report](/repo/report.md:12), [download](</exports/Client brief.pdf>), [old](old.pdf). Maybe create /repo/plan.md later.'
        },
        { type: 'text', text: '[Report again](/repo/report.md)' }
      ]
    }
  ])
  expect(resources.outputs.map(({ detail }) => detail)).toEqual([
    '/exports/Client brief.pdf',
    '/repo/report.md'
  ])
  expect(resources.changedFiles.map(({ detail }) => detail)).toEqual([
    '/repo/src/app.ts',
    '/repo/docs/setup.md',
    'old.pdf'
  ])
})

it('collects assistant file and web links separately from tool sources and user URLs', () => {
  const resources = collectSessionResources([
    {
      id: 'reply',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        {
          type: 'text',
          text: '[Report](</exports/report.md>) [Site](https://example.com/result) and file:///exports/chart.png. https://example.com/result'
        }
      ]
    },
    {
      id: 'user',
      role: 'user',
      source: 'transcript',
      timestamp: null,
      blocks: [{ type: 'text', text: 'https://example.com/private' }]
    },
    {
      id: 'unsafe',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        {
          type: 'text',
          text: '[Unsafe](javascript:alert(1)) https://user:password@example.com/private'
        }
      ]
    }
  ])
  expect(resources.links.map(({ detail }) => detail)).toEqual([
    '/exports/report.md',
    '/exports/chart.png',
    'https://example.com/result'
  ])
  expect(resources.sources).toEqual([])
})

it('keeps code, configuration and line citations out of outputs while retaining their links and edits', () => {
  const resources = collectSessionResources([
    {
      id: 'code-review',
      role: 'assistant',
      source: 'transcript',
      timestamp: null,
      blocks: [
        ...['/repo/src/app.tsx', 'C:\\repo\\service.cs', '/repo/package.json'].map(
          (path, index) => ({
            type: 'tool-call' as const,
            name: 'Write',
            callId: `code-${index}`,
            state: 'completed' as const,
            input: { file_path: path, content: 'Updated' }
          })
        ),
        {
          type: 'text',
          text: '[App](/repo/src/app.tsx:12) [Service](<C:\\repo\\service.cs>) [Config](/repo/package.json) [Docs](/repo/README.md:8) [Report](</exports/report.md>) [Workbook](/exports/costs.xlsx) [Image](/exports/chart.png)'
        }
      ]
    }
  ])
  expect(resources.outputs.map((entry) => entry.detail)).toEqual([
    '/exports/report.md',
    '/exports/costs.xlsx',
    '/exports/chart.png'
  ])
  expect(resources.changedFiles.map((entry) => entry.detail)).toEqual([
    '/repo/src/app.tsx',
    'C:\\repo\\service.cs',
    '/repo/package.json'
  ])
  expect(resources.links.map((entry) => entry.detail)).toEqual([
    '/repo/src/app.tsx',
    'C:\\repo\\service.cs',
    '/repo/package.json',
    '/repo/README.md',
    '/exports/report.md',
    '/exports/costs.xlsx',
    '/exports/chart.png'
  ])
})
