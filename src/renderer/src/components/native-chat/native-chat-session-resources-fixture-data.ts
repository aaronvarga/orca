import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'

export const resourceMessages: NativeChatMessage[] = [
  {
    id: 'upload',
    role: 'user',
    source: 'transcript',
    timestamp: 1,
    blocks: [
      { type: 'image-ref', path: '/projects/client/Uploads/Whiteboard.png' },
      {
        type: 'text',
        text: '@"/tmp/agent-session-attachments/12345678-1234-1234-1234-123456789abc/Discovery notes.txt"'
      }
    ]
  },
  {
    id: 'research',
    role: 'assistant',
    source: 'transcript',
    timestamp: 2,
    blocks: [
      {
        type: 'tool-call',
        name: 'Read',
        state: 'completed',
        input: { file_path: '/projects/client/Requirements.md' }
      },
      {
        type: 'tool-call',
        name: 'web_search',
        state: 'completed',
        input: { query: 'Architecture patterns' },
        webSearchResults: [
          { title: 'Architecture center', url: 'https://learn.microsoft.com/azure/architecture/' },
          {
            title: 'A longer source title that stays readable inside a narrow project pane',
            url: 'https://example.com/research/architecture-patterns'
          }
        ]
      }
    ]
  },
  {
    id: 'outputs',
    role: 'assistant',
    source: 'transcript',
    timestamp: 3,
    blocks: [
      {
        type: 'text',
        text: '[Architecture brief](</projects/client/Outputs/Architecture brief.md>) and [Cost comparison](</projects/client/Outputs/Cost comparison.csv>) and https://example.com/research/summary. [Implementation](/projects/client/src/config.ts:1)'
      },
      {
        type: 'tool-call',
        name: 'Write',
        state: 'completed',
        input: { file_path: '/projects/client/src/config.ts', content: 'export const ready = true' }
      },
      {
        type: 'tool-call',
        name: 'Write',
        state: 'completed',
        input: {
          file_path: '/projects/client/Outputs/Architecture brief.md',
          content: '# Architecture brief'
        }
      },
      {
        type: 'tool-call',
        name: 'Write',
        state: 'completed',
        input: { file_path: '/projects/client/Outputs/Cost comparison.csv', content: 'Option,Cost' }
      }
    ]
  }
]
