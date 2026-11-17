import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { afterAll, expect, it } from 'vitest'
import { azureDevOpsHtmlConfig } from './work-item-html'

const browser = await chromium
  .launch({ headless: true })
  .catch(() => chromium.launch({ headless: true, channel: 'chrome' }))
  .catch(() => null)
afterAll(async () => {
  await browser?.close()
})
it.skipIf(!browser)(
  'renders Azure HTML without scripts, handlers, frames, image loads or unsafe links in Chromium',
  async () => {
    try {
      if (!browser) {
        throw new Error('Chromium is unavailable')
      }
      const page = await browser.newPage()
      const requested: string[] = []
      await page.route('**/*', (route) => {
        requested.push(route.request().url())
        return route.abort()
      })
      const require = createRequire(import.meta.url)
      await page.addScriptTag({
        content: readFileSync(require.resolve('dompurify/dist/purify.min.js'), 'utf8')
      })
      const result = await page.evaluate((config) => {
        const clean = globalThis.DOMPurify!.sanitize(
          '<script>alert(1)</script><iframe src="https://bad.example"></iframe><img src="https://track.example/a"><p onclick="alert(2)">Useful text</p><a href="javascript:alert(3)">Bad</a><a href="https://work.example/task">Safe</a>',
          config
        )
        document.body.innerHTML = clean
        return {
          unsafe: document.body.querySelector('script,iframe,img,[onclick]') !== null,
          text: document.body.textContent,
          links: Array.from(document.querySelectorAll('a'), (a) => a.getAttribute('href'))
        }
      }, azureDevOpsHtmlConfig)
      expect(result.unsafe).toBe(false)
      expect(result.text).toContain('Useful text')
      expect(result.links).toEqual([null, 'https://work.example/task'])
      expect(requested).toEqual([])
    } finally {
      await browser?.close()
    }
  }
)
