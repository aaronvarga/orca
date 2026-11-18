import { describe, expect, it } from 'vitest'
import { createForkReleaseMonitor } from './fork-release-monitor'

describe('fork release availability', () => {
  it.each([
    ['v1.4.215', 'v1.4.215'],
    ['v1.4.214', null],
    ['v1.4.213', null],
    ['v1.10.0', 'v1.10.0']
  ])('compares %s with the running fork base', async (release, expected) => {
    const monitor = createForkReleaseMonitor(
      '1.4.214',
      async () => release,
      () => {}
    )
    expect((await monitor.check()).releaseTag).toBe(expected)
  })

  it.each([null, 'v1.4.216-rc.1', 'invalid'])(
    'keeps a known update when lookup returns %s',
    async (failedRelease) => {
      let release: string | null = 'v1.4.215'
      const monitor = createForkReleaseMonitor(
        '1.4.214',
        async () => release,
        () => {}
      )
      await monitor.check()
      release = failedRelease
      expect(await monitor.check()).toMatchObject({
        releaseTag: 'v1.4.215',
        checking: false,
        error: expect.any(String)
      })
      release = 'v1.4.217'
      expect(await monitor.check()).toMatchObject({
        releaseTag: 'v1.4.217',
        checking: false,
        error: null
      })
    }
  )

  it('recovers after a rejected lookup without dropping an offered update', async () => {
    let failed = false
    const monitor = createForkReleaseMonitor(
      '1.4.214',
      async () => {
        if (failed) {
          throw new Error('offline')
        }
        return 'v1.4.215'
      },
      () => {}
    )
    await monitor.check()
    failed = true
    expect(await monitor.check()).toEqual({
      baseVersion: '1.4.214',
      releaseTag: 'v1.4.215',
      checking: false,
      error: 'offline'
    })
  })
})
