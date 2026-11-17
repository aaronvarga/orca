import {
  JIRA_PAYLOAD_CHUNK_CHARS,
  JIRA_PAYLOAD_MAX_CHARS
} from '../../../../../shared/jira/jira-payload-stream'
export function emitIntegrationPayload(value: unknown, emit: (result: unknown) => void): void {
  const payload = JSON.stringify(value)
  if (payload.length > JIRA_PAYLOAD_MAX_CHARS) {
    throw new Error('Integration payload exceeded the transfer limit. Open the item externally.')
  }
  for (let offset = 0; offset < payload.length; offset += JIRA_PAYLOAD_CHUNK_CHARS) {
    emit({ type: 'chunk', content: payload.slice(offset, offset + JIRA_PAYLOAD_CHUNK_CHARS) })
  }
  emit({ type: 'end' })
}
