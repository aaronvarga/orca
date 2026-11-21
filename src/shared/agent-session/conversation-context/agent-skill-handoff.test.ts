import { expect, it } from 'vitest'
import { completedSkillHandoff, publishedSkillHandoffReceipt } from './agent-skill-handoff'

it('accepts only a complete briefing for the requested handoff', () => {
  expect(
    completedSkillHandoff(
      '# Session Handoff\n- Handoff ID: a\nBody\n<!-- handoff-complete: a -->\n',
      'a'
    )
  ).toBe(true)
  expect(
    completedSkillHandoff(
      '# Session Handoff\n- Handoff ID: b\nBody\n<!-- handoff-complete: b -->\n',
      'a'
    )
  ).toBe(false)
  expect(
    completedSkillHandoff('# Session Handoff\n- Handoff ID: a\nBody still being written', 'a')
  ).toBe(false)
})

it('requires the matching publication receipt rather than another session or partial JSON', () => {
  expect(
    publishedSkillHandoffReceipt('{"version":1,"handoffId":"a","file":"a.md","complete":true}', 'a')
  ).toBe(true)
  expect(
    publishedSkillHandoffReceipt('{"version":1,"handoffId":"b","file":"b.md","complete":true}', 'a')
  ).toBe(false)
  expect(
    publishedSkillHandoffReceipt(
      '{"version":1,"handoffId":"a","file":"other.md","complete":true}',
      'a'
    )
  ).toBe(false)
  expect(
    publishedSkillHandoffReceipt(
      '{"version":1,"handoffId":"a","file":"a.md","complete":false}',
      'a'
    )
  ).toBe(false)
  expect(publishedSkillHandoffReceipt('{"version":1,', 'a')).toBe(false)
})

it('accepts Windows text encodings without weakening handoff identity checks', () => {
  expect(
    completedSkillHandoff(
      '\uFEFF# Session Handoff\r\n- Handoff ID: win\r\nBody\r\n<!-- handoff-complete: win -->\r\n',
      'win'
    )
  ).toBe(true)
  expect(
    publishedSkillHandoffReceipt(
      '\uFEFF{"version":1,"handoffId":"win","file":"win.md","complete":true}',
      'win'
    )
  ).toBe(true)
})
