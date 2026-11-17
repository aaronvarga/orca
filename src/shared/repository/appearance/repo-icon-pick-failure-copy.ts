// One English table for repo icon upload refusals: main builds the wire `error`, the renderer translates by code.
export const REPO_ICON_PICK_FAILURE_COPY = {
  unsupportedFormat: 'Repo icons must be PNG or ICNS files.',
  invalidImage: 'This ICNS file does not contain a supported image up to 2048 × 2048 pixels.',
  icnsTooLarge: 'ICNS files must be 10MB or smaller.',
  tooLarge: 'Repo icon image must be 256KB or smaller.'
} as const

export type RepoIconPickFailureCode = keyof typeof REPO_ICON_PICK_FAILURE_COPY

/** Wire shape: `error` stays English; the renderer translates known codes. */
export type RepoIconPickFailure = { ok: false; error: string; errorCode?: string }

export type RepoIconPickResult = { dataUrl: string; fileName: string } | RepoIconPickFailure | null

export function repoIconPickFailure(errorCode: RepoIconPickFailureCode): RepoIconPickFailure {
  return { ok: false, error: REPO_ICON_PICK_FAILURE_COPY[errorCode], errorCode }
}
