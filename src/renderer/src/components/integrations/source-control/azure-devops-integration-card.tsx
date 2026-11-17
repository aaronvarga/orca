import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { getLocalExecutionHostLabel } from '../../../../../shared/execution-host/execution-host'
import { AZURE_DEVOPS_CONNECTIONS_CHANGED } from '@/runtime/azure-devops/use-azure-devops-readiness'
import { useEffect, useState } from 'react'
import { PanelsTopLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { azureDevOpsApiForSource } from '@/runtime/azure-devops/runtime-azure-devops-client'
import {
  IntegrationCardDetails,
  IntegrationCardShell
} from '../presentation/integration-card-shell'
import { ProviderHostScopeControl } from '../../provider-accounts/ProviderHostScopeControl'
import { UnsealedCredentialNotice } from '../../provider-accounts/UnsealedCredentialNotice'
import type { AzureDevOpsStatus } from '../../../../../shared/azure-devops/boards-types'

export function AzureDevOpsIntegrationCard({
  source
}: {
  source: RuntimeClientTarget
}): React.JSX.Element {
  const scopeKey = source.kind === 'environment' ? source.environmentId : 'local'
  return <AzureDevOpsConnections key={scopeKey} source={source} />
}
function AzureDevOpsConnections({ source }: { source: RuntimeClientTarget }): React.JSX.Element {
  const t = useTranslate()
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [status, setStatus] = useState<AzureDevOpsStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [label, setLabel] = useState('')
  const [token, setToken] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void azureDevOpsApiForSource(source, controller.signal)
      .status()
      .then(setStatus)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(String(cause))
        }
      })
    return () => controller.abort()
  }, [source])
  async function perform(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setError('')
    const api = azureDevOpsApiForSource(source)
    await action()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause))
      })
      .then(() => api.status())
      .then((status) => {
        setStatus(status)
        window.dispatchEvent(new Event(AZURE_DEVOPS_CONNECTIONS_CHANGED))
      })
      .catch((cause: unknown) => {
        setError((current) => current || String(cause))
      })
      .finally(() => setBusy(false))
  }
  return (
    <IntegrationCardShell
      icon={<PanelsTopLeft className="size-5" />}
      name="Azure DevOps"
      description={t(
        'azure.settings.description',
        'Azure Boards and Azure Repos, with credentials stored on the selected host.'
      )}
      checking={!status && !error}
      statusTone={status?.connections.length ? 'connected' : 'attention'}
      statusLabel={
        status?.connections.length
          ? t('azure.settings.connected', 'Connected')
          : t('azure.settings.setup', 'Connect an organization')
      }
    >
      <IntegrationCardDetails>
        <ProviderHostScopeControl
          labelPrefix={t('azure.settings.host', 'Credential host')}
          scope={{
            label:
              source.kind === 'environment' ? source.environmentId : getLocalExecutionHostLabel(),
            description: t(
              'azure.settings.scopeDescription',
              'Credentials belong to the host selected at the top of Settings.'
            )
          }}
        />
        <UnsealedCredentialNotice
          credentialName="Azure DevOps PAT"
          protection={status?.credentialProtection ?? null}
        />
        {status?.credentialError && (
          <p role="alert" className="text-destructive">
            {status.credentialError}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {status?.connections.map((connection) => (
          <div key={connection.id} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate">{connection.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {connection.baseUrl} · {connection.viewer.displayName}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  azureDevOpsApiForSource(source).testConnection({
                    connectionId: connection.id,
                    revision: connection.revision
                  })
                )
              }
            >
              {t('azure.settings.test', 'Test')}
            </Button>
            {!connection.externallyManaged && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBaseUrl(connection.baseUrl)
                  setLabel(connection.label)
                  setToken('')
                  setDialogOpen(true)
                }}
              >
                {t('azure.settings.reconnect', 'Reconnect')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  azureDevOpsApiForSource(source).disconnect({ connectionId: connection.id })
                )
              }
            >
              {t('azure.settings.disconnect', 'Disconnect')}
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            setBaseUrl('')
            setLabel('')
            setToken('')
            setDialogOpen(true)
          }}
        >
          {t('azure.settings.connect', 'Connect organization')}
        </Button>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              setToken('')
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('azure.settings.connect', 'Connect organization')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t(
                'azure.settings.scopes',
                'Use Work Items Read (vso.work) and Project and Team Read (vso.project). Code Read is optional for pull requests; creating pull requests requires Code Read & Write. The token stays on the selected host.'
              )}
            </p>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                const profileId = useAppStore.getState().activeOrcaProfileId
                void perform(async () => {
                  await azureDevOpsApiForSource(source).connect({ baseUrl, label, token })
                  setToken('')
                  setDialogOpen(false)
                  const current = useAppStore.getState().settings
                  if (
                    useAppStore.getState().activeOrcaProfileId === profileId &&
                    current &&
                    !current.visibleTaskProviders.includes('azure-devops')
                  ) {
                    await updateSettings({
                      visibleTaskProviders: [...current.visibleTaskProviders, 'azure-devops']
                    })
                  }
                })
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="azure-base-url">
                  {t('azure.settings.url', 'Organization or collection URL')}
                </Label>
                <Input
                  id="azure-base-url"
                  type="url"
                  required
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder={t('azure.settings.exampleUrl', 'https://dev.azure.com/organization')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="azure-label">{t('azure.settings.label', 'Label')}</Label>
                <Input
                  id="azure-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="azure-token">
                  {t('azure.settings.token', 'Personal access token')}
                </Label>
                <Input
                  id="azure-token"
                  type="password"
                  autoComplete="off"
                  required
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {t('azure.settings.verifySave', 'Verify and save')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </IntegrationCardDetails>
    </IntegrationCardShell>
  )
}
