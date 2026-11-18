export type ForkReleaseStatus = {
  baseVersion: string
  releaseTag: string | null
  checking: boolean
  error: string | null
}
