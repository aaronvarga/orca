import type { RuntimeRpcResponse } from '../../../../shared/remote-runtime/rpc/runtime-rpc-envelope'
import {
  isJiraPayloadStreamMessage,
  JIRA_PAYLOAD_MAX_CHARS
} from '../../../../shared/jira/jira-payload-stream'
import { RuntimeRpcCallError } from '../rpc/calls/runtime-rpc-result'

type RuntimeIntegrationPayloadTarget = { kind: 'environment'; environmentId: string }

export async function readRuntimeIntegrationPayload<TResult>(
  target: RuntimeIntegrationPayloadTarget,
  method: string,
  params: unknown,
  signal?: AbortSignal
): Promise<TResult> {
  const chunks: string[] = []
  let receivedChars = 0
  let unsubscribe: (() => void) | null = null
  let unsubscribeWhenReady = false

  const close = (): void => {
    if (unsubscribe) {
      unsubscribe()
    } else {
      unsubscribeWhenReady = true
    }
  }

  return new Promise<TResult>((resolve, reject) => {
    signal?.throwIfAborted()
    let settled = false
    const deadline = setTimeout(
      () =>
        fail(
          new Error(
            'Remote integration payload did not complete before the read deadline. Open the item externally.'
          )
        ),
      60_000
    )
    const abort = (): void => fail(signal?.reason ?? new Error('Read cancelled.'))
    signal?.addEventListener('abort', abort, { once: true })
    const fail = (error: unknown): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(deadline)
      signal?.removeEventListener('abort', abort)
      close()
      reject(error)
    }
    const finish = (): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(deadline)
      signal?.removeEventListener('abort', abort)
      close()
      try {
        resolve(JSON.parse(chunks.join('')) as TResult)
      } catch {
        reject(new Error('Remote integration payload was not valid JSON.'))
      }
    }

    void window.api.runtimeEnvironments
      .subscribe(
        {
          selector: target.environmentId,
          method,
          params,
          timeoutMs: 60_000
        },
        {
          onResponse: (response) => {
            const rpcResponse = response as RuntimeRpcResponse<unknown>
            if (!rpcResponse.ok) {
              fail(new RuntimeRpcCallError(rpcResponse))
              return
            }
            const message = rpcResponse.result
            if (!isJiraPayloadStreamMessage(message)) {
              fail(new Error('Remote integration payload stream returned an invalid message.'))
              return
            }
            if (message.type === 'end') {
              finish()
              return
            }
            receivedChars += message.content.length
            if (receivedChars > JIRA_PAYLOAD_MAX_CHARS) {
              fail(new Error('Remote integration payload exceeded the transfer limit.'))
              return
            }
            chunks.push(message.content)
          },
          onError: fail,
          onClose: () =>
            fail(new Error('Remote integration payload stream closed before completion.'))
        }
      )
      .then((handle) => {
        unsubscribe = handle.unsubscribe
        if (unsubscribeWhenReady) {
          unsubscribe()
        }
      })
      .catch(fail)
  })
}
