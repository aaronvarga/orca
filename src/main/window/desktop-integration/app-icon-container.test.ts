import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readRasterImageDimensions } from '../../../shared/file-preview/raster-image-dimensions'
import { readAppIconRaster } from './app-icon-container'

describe('app icon containers', () => {
  it('extracts the largest raster from the real macOS and Windows icons', () => {
    const icns = readAppIconRaster(readFileSync('resources/build/icon.icns'))
    const ico = readAppIconRaster(readFileSync('resources/build/icon.ico'))
    expect(icns && readRasterImageDimensions(icns)).toEqual({ width: 1024, height: 1024 })
    expect(ico && readRasterImageDimensions(ico)).toEqual({ width: 256, height: 256 })
  })
  it('rejects truncated or out-of-bounds container entries', () => {
    const icns = readFileSync('resources/build/icon.icns')
    expect(readAppIconRaster(icns.subarray(0, -1))).toBeNull()
    const ico = Buffer.from(readFileSync('resources/build/icon.ico'))
    ico.writeUInt32LE(0xffffffff, 18)
    expect(readAppIconRaster(ico)).toBeNull()
  })
})
