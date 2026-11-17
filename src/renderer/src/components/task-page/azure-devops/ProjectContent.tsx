import { AzureWorkItemList } from './WorkItemList'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslate } from '@/i18n/use-translate'
import { azureDevOpsApiForSource } from '@/runtime/azure-devops/runtime-azure-devops-client'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/rpc/targets/runtime-client-target'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import type { AzureTaskPageModel } from './azure-task-page-model'
import type {
  AzureDevOpsConnection,
  AzureDevOpsProject,
  AzureDevOpsQuery,
  AzureDevOpsWorkItem,
  AzureDevOpsWorkItemResults,
  AzureDevOpsMetadata
} from '../../../../../shared/azure-devops/boards-types'
import { normalizeTaskSourceContext } from '../../../../../shared/work-items/task-source-context'
import { AzureWorkItemDetail } from './WorkItemDetail'

import { AzurePicker } from './AzurePicker'
import type { AzureTaskSelection } from './azure-task-selection'
export function AzureDevOpsProjectContent({
  model,
  connection,
  project,
  selection,
  setSelection,
  refresh
}: {
  model: AzureTaskPageModel
  connection: AzureDevOpsConnection
  project: AzureDevOpsProject
  selection: AzureTaskSelection
  setSelection: React.Dispatch<React.SetStateAction<AzureTaskSelection>>
  refresh: number
}): React.JSX.Element {
  const t = useTranslate()
  const [result, setResult] = useState<AzureDevOpsWorkItemResults | null>(null)
  const [detail, setDetail] = useState<AzureDevOpsWorkItem | null>(null)
  const detailId = selection.detailId
  const setDetailId = (detailId: number | null): void =>
    setSelection((old) => ({ ...old, detailId }))
  const [queries, setQueries] = useState<AzureDevOpsQuery[]>([])
  const folderId = selection.folderId
  const setFolderId = (folderId: string): void =>
    setSelection((old) => ({ ...old, folderId, queryId: '', queryName: '' }))
  const [teams, setTeams] = useState<AzureDevOpsProject[]>([])
  const [metadata, setMetadata] = useState<AzureDevOpsMetadata>({ types: [], states: [] })
  const [error, setError] = useState('')
  const [listLoading, setListLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const loading = detailId ? detailLoading : listLoading
  const target = useMemo(
    () => ipcOrRuntimeTargetForHostId(model.accountBackedTaskSourceHostId)!,
    [model.accountBackedTaskSourceHostId]
  )
  const args = useMemo(
    () => ({ connectionId: connection.id, revision: connection.revision, projectId: project.id }),
    [connection.id, connection.revision, project.id]
  )
  useEffect(() => {
    const controller = new AbortController()
    const api = azureDevOpsApiForSource(target, controller.signal)
    void Promise.all([api.listTeams(args), api.metadata(args)])
      .then(([teamRows, meta]) => {
        if (!controller.signal.aborted) {
          setTeams(teamRows)
          setMetadata(meta)
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(String(cause))
        }
      })
    return () => controller.abort()
  }, [target, args])
  useEffect(() => {
    const controller = new AbortController()
    setQueries([])
    void azureDevOpsApiForSource(target, controller.signal)
      .listQueries({ ...args, folderId: folderId || undefined })
      .then(setQueries)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(String(cause))
        }
      })
    return () => controller.abort()
  }, [target, args, folderId])
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setListLoading(true)
    if (selection.view === 'query' && !selection.queryId) {
      setListLoading(false)
      return () => controller.abort()
    }
    setError('')
    void azureDevOpsApiForSource(target, controller.signal)
      .queryWorkItems({
        ...args,
        view: selection.view === 'all' ? 'all' : 'assigned',
        ...(selection.view === 'query'
          ? { queryId: selection.queryId, teamId: selection.teamId || undefined }
          : {
              search: selection.search,
              state: selection.state || undefined,
              type: selection.type || undefined
            })
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult(data)
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          const message = cause instanceof Error ? cause.message : String(cause)
          setError(message)
          if (selection.view === 'query' && /404|not found|permission denied/i.test(message)) {
            setSelection((old) => ({ ...old, queryId: '', queryName: '' }))
          }
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setListLoading(false)
        }
      })
    return () => controller.abort()
  }, [
    target,
    args,
    selection.view,
    selection.queryId,
    selection.teamId,
    selection.search,
    selection.state,
    selection.type,
    refresh,
    setSelection
  ])
  useEffect(() => {
    if (!detailId) {
      return
    }
    const controller = new AbortController()
    setDetail(null)
    setError('')
    setDetailLoading(true)
    void azureDevOpsApiForSource(target, controller.signal)
      .getWorkItem({ ...args, id: detailId })
      .then((item) => {
        if (!controller.signal.aborted) {
          setDetail(item)
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(String(cause))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setDetailLoading(false)
        }
      })
    return () => controller.abort()
  }, [target, args, detailId, refresh])
  const externalUrl =
    selection.view === 'query' && selection.queryId
      ? `${connection.baseUrl}/${encodeURIComponent(project.id)}/_queries/query/${encodeURIComponent(selection.queryId)}`
      : `${connection.baseUrl}/${encodeURIComponent(project.id)}/_workitems`
  function launch(item: AzureDevOpsWorkItem): void {
    const context = normalizeTaskSourceContext({
      provider: 'azure-devops',
      projectId: model.fallbackTaskSourceProjectId,
      hostId: model.accountBackedTaskSourceHostId,
      providerIdentity: {
        provider: 'azure-devops',
        connectionId: connection.id,
        baseUrl: connection.baseUrl,
        projectId: item.project.id,
        teamId: selection.teamId || null
      },
      accountLabel: connection.label
    })
    model.openModal('new-workspace-composer', {
      linkedWorkItem: {
        provider: 'azure-devops',
        type: 'issue',
        number: item.id,
        title: item.title,
        url: item.url,
        linkedContext: {
          provider: 'azure-devops',
          version: 1,
          renderedText: [
            `AB#${item.id}: ${item.title}`,
            item.url,
            item.description,
            item.acceptanceCriteria
          ].join('\n\n')
        }
      },
      taskSourceContext: context,
      prefilledName: item.title,
      telemetrySource: 'sidebar'
    })
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {connection.label} · {project.name} · {connection.viewer.displayName}
      </p>
      {detailId ? (
        <AzureWorkItemDetail
          detail={detail}
          onBack={() => {
            setDetailId(null)
            setDetail(null)
          }}
          onLaunch={launch}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <AzurePicker
              label={t('azure.tasks.view', 'View')}
              value={selection.view}
              options={[
                { id: 'assigned', name: t('azure.tasks.assigned', 'Assigned to me') },
                { id: 'all', name: t('azure.tasks.all', 'All work items') },
                { id: 'query', name: t('azure.tasks.saved', 'Saved query') }
              ]}
              onChange={(view) => {
                if (view === 'assigned' || view === 'all' || view === 'query') {
                  setSelection((old) => ({ ...old, view }))
                }
              }}
            />
            {selection.view === 'query' ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setFolderId('')}>
                  {t('azure.tasks.queryRoots', 'Query roots')}
                </Button>
                <AzurePicker
                  label={t('azure.tasks.saved', 'Saved query')}
                  value={selection.queryId}
                  options={[
                    ...queries.map((entry) => ({
                      id: entry.id,
                      name: `${entry.isFolder ? '▸ ' : ''}${entry.name}`
                    })),
                    ...(selection.queryId &&
                    !queries.some((entry) => entry.id === selection.queryId)
                      ? [{ id: selection.queryId, name: selection.queryName || selection.queryId }]
                      : [])
                  ]}
                  onChange={(id) => {
                    const query = queries.find((entry) => entry.id === id)
                    if (query?.isFolder) {
                      setFolderId(id)
                    } else {
                      setSelection((old) => ({ ...old, queryId: id, queryName: query?.name ?? id }))
                    }
                  }}
                />
                <AzurePicker
                  label={t('azure.tasks.team', 'Team (optional)')}
                  value={selection.teamId || 'none'}
                  options={[{ id: 'none', name: t('azure.tasks.noTeam', 'No team') }, ...teams]}
                  onChange={(teamId) =>
                    setSelection((old) => ({ ...old, teamId: teamId === 'none' ? '' : teamId }))
                  }
                />
              </>
            ) : (
              <>
                <Input
                  className="h-8 w-52"
                  aria-label={t('azure.tasks.search', 'Search ID or title')}
                  placeholder={t('azure.tasks.search', 'Search ID or title')}
                  value={selection.search}
                  onChange={(event) =>
                    setSelection((old) => ({ ...old, search: event.target.value }))
                  }
                />
                <AzurePicker
                  label={t('azure.tasks.state', 'State')}
                  value={selection.state || 'any'}
                  options={[
                    { id: 'any', name: t('azure.tasks.anyState', 'Any state') },
                    ...metadata.states.map((name) => ({ id: name, name }))
                  ]}
                  onChange={(state) =>
                    setSelection((old) => ({ ...old, state: state === 'any' ? '' : state }))
                  }
                />
                <AzurePicker
                  label={t('azure.tasks.type', 'Type')}
                  value={selection.type || 'any'}
                  options={[
                    { id: 'any', name: t('azure.tasks.anyType', 'Any type') },
                    ...metadata.types.map((name) => ({ id: name, name }))
                  ]}
                  onChange={(type) =>
                    setSelection((old) => ({ ...old, type: type === 'any' ? '' : type }))
                  }
                />
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => openAppHttpLink(externalUrl, { event })}
            >
              {t('azure.tasks.external', 'Open in Azure DevOps')}
            </Button>
          </div>
          {result?.capped && (
            <p role="status" className="text-sm text-muted-foreground">
              {t(
                'azure.tasks.capped',
                'First 200 results; narrow the filters or open in Azure DevOps.'
              )}
            </p>
          )}
          {!!result?.omittedIds.length && (
            <p role="status" className="text-sm text-muted-foreground">
              {t(
                'azure.tasks.partial',
                'Some work items were deleted or are inaccessible. Results are partial.'
              )}{' '}
              {result.omittedIds.map((id) => `AB#${id}`).join(', ')}
            </p>
          )}
          {result && !result.items.length && (
            <p className="text-sm text-muted-foreground">
              {t('azure.tasks.empty', 'No matching work items.')}
            </p>
          )}
          {result && result.items.length > 0 && (
            <AzureWorkItemList items={result.items} onOpenItem={setDetailId} />
          )}
        </>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('azure.tasks.loading', 'Loading Azure Boards…')}
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          <p>{error}</p>
          <Button variant="link" onClick={(event) => openAppHttpLink(externalUrl, { event })}>
            {t('azure.tasks.external', 'Open in Azure DevOps')}
          </Button>
        </div>
      )}
    </div>
  )
}
