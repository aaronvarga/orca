import { expect, it } from 'vitest'
import type { NativeChatMessage, NativeChatBlock } from './native-chat-types'
import type { NativeChatResolvedPrompt } from './input/questions/native-chat-resolution-receipt'
import { collectSessionQuestions } from './session-questions'

const message = (
  id: string,
  role: NativeChatMessage['role'],
  blocks: NativeChatBlock[]
): NativeChatMessage => ({ id, role, blocks, source: 'transcript', timestamp: null })
const pending = {
  state: 'pending' as const,
  selectedOptionId: null,
  resolvedBy: null,
  resolvedAt: null
}

it('uses journal answers including multiple selections, free text, explicit empty answers and cancellation', () => {
  const receipts = new Map<string, NativeChatResolvedPrompt>([
    [
      'group',
      {
        kind: 'question',
        question: 'Options',
        options: [],
        questions: [
          {
            id: 'choice',
            question: 'Which parts?',
            multiSelect: true,
            options: [
              { id: 'a', label: 'Transcript' },
              { id: 'b', label: 'Chat' }
            ]
          },
          { id: 'text', question: 'Where?', multiSelect: false, options: [] },
          { id: 'empty', question: 'Anything else?', multiSelect: false, options: [] },
          { id: 'missing', question: 'Old answer?', multiSelect: false, options: [] }
        ],
        resolution: {
          ...pending,
          state: 'resolved',
          answers: [
            { questionId: 'choice', optionIds: ['a', 'b'] },
            { questionId: 'text', optionIds: [], other: '/recordings' },
            { questionId: 'empty', optionIds: [], other: '' }
          ]
        }
      }
    ],
    [
      'skip',
      {
        kind: 'question',
        question: 'Continue?',
        options: [],
        resolution: { ...pending, state: 'cancelled' }
      }
    ],
    [
      'approval',
      { kind: 'approval', title: 'Run command?', detail: null, options: [], resolution: pending }
    ]
  ])
  expect(
    collectSessionQuestions(
      [
        message('group', 'system', []),
        message('skip', 'system', []),
        message('approval', 'system', [])
      ],
      receipts
    ).map(({ question, answer, state }) => ({ question, answer, state }))
  ).toEqual([
    { question: 'Which parts?', answer: 'Transcript · Chat', state: 'resolved' },
    { question: 'Where?', answer: '/recordings', state: 'resolved' },
    { question: 'Anything else?', answer: '', state: 'resolved' },
    { question: 'Old answer?', answer: null, state: 'resolved' },
    { question: 'Continue?', answer: null, state: 'cancelled' }
  ])
})

it('pairs repeated async questions with identified replies and ignores queued or agent-authored answers', () => {
  const ask = (callId: string): NativeChatBlock => ({
    type: 'tool-call',
    name: 'request_user_input_async',
    callId,
    input: { questions: [{ title: 'Which model?' }] }
  })
  const reply = (callId: string, answer: string) => ({
    type: 'text' as const,
    text: `<send_user_message_question_reply>${JSON.stringify([
      { answer, questionItemId: JSON.stringify(['request_user_input_async', callId, 0]) }
    ])}</send_user_message_question_reply>`
  })
  const first = message('one', 'assistant', [ask('one')])
  const duplicate = message('duplicate', 'assistant', [ask('one')])
  const second = message('two', 'assistant', [ask('two')])
  const queued = { ...message('queued', 'user', [reply('one', 'Wrong')]), queued: true as const }
  const agent = {
    ...message('agent', 'user', [reply('one', 'Wrong')]),
    from: { kind: 'agent' as const, senders: [], orchestration: null }
  }
  const messages = [
    first,
    duplicate,
    second,
    queued,
    agent,
    message('malformed', 'user', [
      {
        type: 'text',
        text: '<send_user_message_question_reply>invalid</send_user_message_question_reply>'
      }
    ]),
    message('answer', 'user', [reply('two', 'Sonnet')])
  ]
  expect(collectSessionQuestions(messages, new Map()).map((row) => row.answer)).toEqual([
    null,
    'Sonnet'
  ])
})

it('reads quoted native replies without treating unrelated prose as an answer', () => {
  const messages = [
    message('ask', 'assistant', [
      {
        type: 'tool-call',
        name: 'request_user_input_async',
        callId: 'ask',
        input: { questions: [{ title: 'Which folder?' }, { title: 'Which model?' }] }
      }
    ]),
    message('unrelated', 'user', [{ type: 'text', text: 'Please also add a Links section.' }]),
    message('answers', 'user', [
      { type: 'text', text: '> Which folder?\n\n/recordings\n\n> Which model?\n\nSonnet' }
    ]),
    message('later', 'assistant', [
      {
        type: 'tool-call',
        name: 'AskUserQuestion',
        callId: 'later',
        input: { questions: [{ question: 'Continue?', options: [] }] }
      }
    ])
  ]
  expect(
    collectSessionQuestions(messages, new Map()).map(({ question, answer }) => ({
      question,
      answer
    }))
  ).toEqual([
    { question: 'Which folder?', answer: '/recordings' },
    { question: 'Which model?', answer: 'Sonnet' },
    { question: 'Continue?', answer: null }
  ])
})
