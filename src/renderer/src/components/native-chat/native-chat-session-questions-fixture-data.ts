import type { NativeChatMessage } from '../../../../shared/native-chat/native-chat-types'
import type { NativeChatResolvedPrompt } from '../../../../shared/native-chat/input/questions/native-chat-resolution-receipt'

export const questionMessages: NativeChatMessage[] = [
  'choices',
  'location',
  'cancelled',
  'waiting'
].map((id) => ({
  id,
  role: 'system',
  source: 'transcript',
  timestamp: null,
  blocks: []
}))
const pending = {
  state: 'pending' as const,
  selectedOptionId: null,
  resolvedBy: null,
  resolvedAt: null
}
export const questionReceipts = new Map<string, NativeChatResolvedPrompt>([
  [
    'choices',
    {
      kind: 'question',
      question: 'Which parts should we include?',
      options: [],
      questions: [
        {
          id: 'scope',
          question: 'Which parts should we include in the first release?',
          multiSelect: true,
          options: [
            { id: 'recording', label: 'Live transcript' },
            { id: 'chat', label: 'Claude conversation' }
          ]
        }
      ],
      resolution: {
        ...pending,
        state: 'resolved',
        answers: [{ questionId: 'scope', optionIds: ['recording', 'chat'] }]
      }
    }
  ],
  [
    'location',
    {
      kind: 'question',
      question: 'Where should exported recordings and conversation summaries be saved?',
      options: [],
      freeTextQuestionId: 'path',
      resolution: {
        ...pending,
        state: 'resolved',
        answers: [
          {
            questionId: 'path',
            optionIds: [],
            other: '/Users/aaron/Recordings/Local Transcriber/Client meetings/Architecture review'
          }
        ]
      }
    }
  ],
  [
    'cancelled',
    {
      kind: 'question',
      question: 'Would you like to start another recording?',
      options: [],
      resolution: { ...pending, state: 'cancelled' }
    }
  ],
  [
    'waiting',
    {
      kind: 'question',
      question: 'What should we name this conversation?',
      options: [],
      resolution: pending
    }
  ]
])
