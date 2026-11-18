import {
  compareAppVersions,
  isPrereleaseAppVersion,
  isValidAppVersion
} from '../../../shared/app-lifecycle/identity/app-version'
import type { ForkReleaseStatus } from '../../../shared/updater/fork-release-status'

export function createForkReleaseMonitor(
  baseVersion: string,
  lookup: () => Promise<string | null>,
  publish: (status: ForkReleaseStatus) => void
) {
  let status: ForkReleaseStatus = { baseVersion, releaseTag: null, checking: false, error: null }
  let pending: Promise<ForkReleaseStatus> | null = null
  const update = (patch: Partial<ForkReleaseStatus>): void => {
    status = { ...status, ...patch }
    publish(status)
  }
  return {
    getStatus: () => status,
    check: (): Promise<ForkReleaseStatus> => {
      if (pending) {
        return pending
      }
      pending = Promise.resolve().then(async () => {
        update({ checking: true })
        try {
          const tag = await lookup()
          if (
            !tag ||
            !isValidAppVersion(tag) ||
            isPrereleaseAppVersion(tag) ||
            !isValidAppVersion(baseVersion)
          ) {
            throw new Error('Unable to check the latest stable upstream release.')
          }
          update({ releaseTag: compareAppVersions(tag, baseVersion) > 0 ? tag : null, error: null })
        } catch (error) {
          update({ error: error instanceof Error ? error.message : String(error) })
        } finally {
          update({ checking: false })
          pending = null
        }
        return status
      })
      return pending
    }
  }
}
