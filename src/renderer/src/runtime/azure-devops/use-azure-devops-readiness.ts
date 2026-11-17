import { useEffect, useState } from 'react'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { azureDevOpsApiForSource } from './runtime-azure-devops-client'
export const AZURE_DEVOPS_CONNECTIONS_CHANGED = 'orca:azure-devops-connections-changed'
export function useAzureDevOpsReadiness(source: RuntimeClientTarget) {
  const [nonce, setNonce] = useState(0)
  const [readiness, setReadiness] = useState({
    connected: false,
    checking: true,
    unavailable: false
  })
  useEffect(() => {
    const refresh = (): void => setNonce((value) => value + 1)
    window.addEventListener(AZURE_DEVOPS_CONNECTIONS_CHANGED, refresh)
    return () => window.removeEventListener(AZURE_DEVOPS_CONNECTIONS_CHANGED, refresh)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setReadiness({ connected: false, checking: true, unavailable: false })
    void azureDevOpsApiForSource(source, controller.signal)
      .status()
      .then((status) => {
        if (!controller.signal.aborted) {
          setReadiness({
            connected: status.connections.length > 0,
            checking: false,
            unavailable: false
          })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setReadiness({ connected: false, checking: false, unavailable: true })
        }
      })
    return () => controller.abort()
  }, [source, nonce])
  return readiness
}
