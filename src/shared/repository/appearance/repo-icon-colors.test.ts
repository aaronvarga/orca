import { expect, it } from 'vitest'
import { resolveRepoIconColors } from './repo-icon-colors'

it('keeps icon glyphs readable on both bright and dark project colors', () => {
  expect(resolveRepoIconColors('#ff0')).toEqual({ background: '#ffff00', foreground: 'black' })
  expect(resolveRepoIconColors('#100030')).toEqual({ background: '#100030', foreground: 'white' })
})

it('accepts portable symbol PNGs while refusing remote URLs and SVG content', async () => {
  const { sanitizeRepoIcon } = await import('./repo-icon')
  const src =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZwkAAAAASUVORK5CYII='
  expect(sanitizeRepoIcon({ type: 'image', source: 'symbol', src, label: 'folder.fill' })).toEqual({
    type: 'image',
    source: 'symbol',
    src,
    label: 'folder.fill'
  })
  expect(
    sanitizeRepoIcon({ type: 'image', source: 'symbol', src: 'https://example.com/icon.png' })
  ).toBeUndefined()
  expect(
    sanitizeRepoIcon({ type: 'image', source: 'symbol', src: 'data:image/svg+xml,<svg/>' })
  ).toBeUndefined()
})
