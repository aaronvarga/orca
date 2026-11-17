export type ReactGrabDevEnv = {
  readonly dev: boolean
  readonly enableFlag?: string
}

export function shouldEnableReactGrab(env: ReactGrabDevEnv): boolean {
  // Opt in explicitly so the development selector does not cover normal app controls.
  return env.dev && env.enableFlag === 'true'
}
