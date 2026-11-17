import { HostCombobox } from '@/components/host-picker/HostCombobox'
import { parseExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { AZURE_DEVOPS_CONNECTIONS_CHANGED } from '@/runtime/azure-devops/use-azure-devops-readiness'
import { selectionSchema, emptySelection, type AzureTaskSelection } from './azure-task-selection'
import { AzurePicker } from './AzurePicker'
import { AzureDevOpsProjectContent } from './ProjectContent'
import { useEffect, useMemo, useState } from 'react'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import { azureDevOpsApiForSource } from '@/runtime/azure-devops/runtime-azure-devops-client'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/rpc/targets/runtime-client-target'
import type { AzureTaskPageModel } from './azure-task-page-model'
import type {
  AzureDevOpsConnection,
  AzureDevOpsProject
} from '../../../../../shared/azure-devops/boards-types'

function loadSelection(key: string): AzureTaskSelection {
  try {
    return selectionSchema.parse(JSON.parse(localStorage.getItem(key) ?? 'null'))
  } catch {
    return emptySelection
  }
}
export function TaskPageAzureDevOpsContent({
  model
}: {
  model: AzureTaskPageModel
}): React.JSX.Element {
  const t = useTranslate()
  const profileId = useAppStore((s) => s.activeOrcaProfileId)
  const hostStorageKey = `orca.azure-boards.host.v1:${profileId}`
  const storedHost = useMemo(() => {
    try {
      const raw = localStorage.getItem(hostStorageKey)
      const parsed = parseExecutionHostId(raw)
      return parsed && parsed.kind !== 'ssh' ? parsed.id : null
    } catch {
      return null
    }
  }, [hostStorageKey])
  const hostId =
    model.pageData.openAzureDevOpsWorkItem?.sourceContext.hostId ??
    model.pageData.azureDevOpsSourceHostId ??
    storedHost ??
    model.accountBackedTaskSourceHostId
  const scopedModel = { ...model, accountBackedTaskSourceHostId: hostId }
  const key = `orca.azure-boards.v1:${profileId}:${hostId}`
  const bound = model.pageData.openAzureDevOpsWorkItem
  const boundIdentity = bound?.sourceContext.providerIdentity
  const instanceKey = JSON.stringify([key, bound?.number, boundIdentity])
  useEffect(() => {
    try {
      localStorage.setItem(hostStorageKey, hostId)
    } catch {}
    if (model.pageData.azureDevOpsSourceHostId !== hostId) {
      useAppStore
        .getState()
        .openTaskPage(
          { ...model.pageData, taskSource: 'azure-devops', azureDevOpsSourceHostId: hostId },
          { recordTasksInteraction: false }
        )
    }
  }, [hostStorageKey, hostId, model.pageData])
  const hosts = [...(model.hostRegistryById?.values() ?? [])]
    .filter((host) => host.kind !== 'ssh')
    .map((host) => ({
      id: host.id,
      label: model.hostLabelById?.get(host.id) ?? host.label,
      detail: host.detail
    }))
  if (!hosts.some((host) => host.id === hostId)) {
    hosts.unshift({ id: hostId, label: model.hostLabelById?.get(hostId) ?? hostId, detail: '' })
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <HostCombobox
        className="mt-3 h-8 max-w-xs"
        size="sm"
        ariaLabel={t('azure.tasks.sourceHost', 'Source host')}
        value={hostId}
        options={hosts}
        onChange={(value) => {
          const parsed = parseExecutionHostId(value)
          if (!parsed || parsed.kind === 'ssh') {
            return
          }
          try {
            localStorage.setItem(hostStorageKey, value)
          } catch {}
          useAppStore
            .getState()
            .openTaskPage(
              { taskSource: 'azure-devops', azureDevOpsSourceHostId: parsed.id },
              { recordTasksInteraction: false }
            )
        }}
      />
      <AzureDevOpsSource key={instanceKey} storageKey={key} model={scopedModel} />
    </div>
  )
}
function AzureDevOpsSource({
  storageKey,
  model
}: {
  storageKey: string
  model: AzureTaskPageModel
}): React.JSX.Element {
  const t = useTranslate()
  const [selection, setSelection] = useState(() => {
    const bound = model.pageData.openAzureDevOpsWorkItem
    const identity = bound?.sourceContext.providerIdentity
    return bound && identity?.provider === 'azure-devops'
      ? {
          ...emptySelection,
          connectionId: identity.connectionId,
          projectId: identity.projectId,
          detailId: bound.number
        }
      : loadSelection(storageKey)
  })
  const [connections, setConnections] = useState<AzureDevOpsConnection[]>([])
  const [projects, setProjects] = useState<AzureDevOpsProject[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const refreshConnections = (): void => {
      setConnections([])
      setProjects([])
      setRefresh((value) => value + 1)
    }
    window.addEventListener(AZURE_DEVOPS_CONNECTIONS_CHANGED, refreshConnections)
    return () => window.removeEventListener(AZURE_DEVOPS_CONNECTIONS_CHANGED, refreshConnections)
  }, [])
  const target = useMemo(
    () => ipcOrRuntimeTargetForHostId(model.accountBackedTaskSourceHostId),
    [model.accountBackedTaskSourceHostId]
  )
  const connection = connections.find((entry) => entry.id === selection.connectionId)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    if (!target) {
      setError(t('azure.tasks.offline', 'Reconnect the source host to load Azure Boards.'))
      setLoading(false)
      return
    }
    void azureDevOpsApiForSource(target, controller.signal)
      .status()
      .then((status) => {
        if (controller.signal.aborted) {
          return
        }
        setConnections(status.connections)
        if (
          selection.connectionId &&
          !status.connections.some((entry) => entry.id === selection.connectionId)
        ) {
          setSelection({ ...emptySelection })
          setNotice(
            t(
              'azure.tasks.removed',
              'The saved organization is unavailable. Select a connection again.'
            )
          )
        }
        setError('')
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [target, refresh, selection.connectionId, t])
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(selection))
    } catch {
      /* Selection remains usable without device storage. */
    }
  }, [selection, storageKey])
  useEffect(() => {
    if (!connection || !target) {
      setProjects([])
      return
    }
    const controller = new AbortController()
    setProjects([])
    setLoading(true)
    setError('')
    void azureDevOpsApiForSource(target, controller.signal)
      .listProjects({ connectionId: connection.id, revision: connection.revision })
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }
        setProjects(result)
        if (selection.projectId && !result.some((entry) => entry.id === selection.projectId)) {
          setSelection((old) => ({ ...old, projectId: '', queryId: '', teamId: '' }))
          setNotice(
            t(
              'azure.tasks.projectRemoved',
              'The saved project is inaccessible. Select an accessible project.'
            )
          )
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [target, connection, refresh, selection.projectId, t])
  const project = projects.find((entry) => entry.id === selection.projectId)
  function openSettings(): void {
    const store = useAppStore.getState()
    store.openSettingsPage()
    store.openSettingsTarget({
      pane: 'integrations',
      repoId: null,
      sectionId: 'integrations-azure-devops',
      ...(target ? { hostScope: target } : {})
    })
  }
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AzurePicker
          label={t('azure.tasks.organization', 'Organization')}
          value={selection.connectionId}
          options={connections.map((entry) => ({ id: entry.id, name: entry.label }))}
          onChange={(connectionId) => {
            setSelection({ ...emptySelection, connectionId })
            setProjects([])
            setNotice('')
          }}
        />
        <AzurePicker
          label={t('azure.tasks.project', 'Project')}
          value={selection.projectId}
          options={projects}
          onChange={(projectId) =>
            setSelection((old) => ({
              ...old,
              projectId,
              queryId: '',
              queryName: '',
              folderId: '',
              teamId: '',
              detailId: null
            }))
          }
        />
        <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>
          {t('azure.tasks.refresh', 'Refresh')}
        </Button>
        <Button variant="ghost" size="sm" onClick={openSettings}>
          {t('azure.tasks.connections', 'Connections')}
        </Button>
      </div>
      {model.pageData.openAzureDevOpsWorkItem && (!connection || !project) && (
        <Button
          variant="link"
          onClick={(event) =>
            openAppHttpLink(model.pageData.openAzureDevOpsWorkItem!.url, { event })
          }
        >
          {t(
            'azure.tasks.unavailableLink',
            'This linked source is unavailable. Reconnect or open in Azure DevOps.'
          )}
        </Button>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('azure.tasks.loading', 'Loading Azure Boards…')}
        </p>
      )}
      {!loading && !connections.length && !error && (
        <div className="rounded-md border p-4">
          <p>
            {t('azure.tasks.setup', 'Connect an Azure DevOps organization to browse work items.')}
          </p>
          <Button className="mt-3" onClick={openSettings}>
            {t('azure.tasks.openSettings', 'Open Azure DevOps settings')}
          </Button>
        </div>
      )}
      {connection && project && target && (
        <AzureDevOpsProjectContent
          key={`${connection.id}:${connection.revision}:${project.id}`}
          model={model}
          connection={connection}
          project={project}
          selection={selection}
          setSelection={setSelection}
          refresh={refresh}
        />
      )}
    </div>
  )
}
