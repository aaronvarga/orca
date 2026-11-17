import { readRasterImageDimensions } from '../../../shared/file-preview/raster-image-dimensions'

/** Modern ICNS and ICO files contain PNG representations; choose the largest decodable raster. */
export function readAppIconRaster(bytes: Buffer): Buffer | null {
  const images: Buffer[] = []
  if (bytes.length >= 8 && bytes.toString('ascii', 0, 4) === 'icns') {
    if (bytes.readUInt32BE(4) !== bytes.length) {
      return null
    }
    for (let offset = 8; offset < bytes.length;) {
      if (images.length >= 256 || offset + 8 > bytes.length) {
        return null
      }
      const size = bytes.readUInt32BE(offset + 4)
      if (size < 8 || size > bytes.length - offset) {
        return null
      }
      images.push(bytes.subarray(offset + 8, offset + size))
      offset += size
    }
  } else if (bytes.length >= 6 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1) {
    const count = bytes.readUInt16LE(4)
    const tableEnd = 6 + count * 16
    if (!count || count > 256 || tableEnd > bytes.length) {
      return null
    }
    for (let index = 0; index < count; index++) {
      const entry = 6 + index * 16
      const size = bytes.readUInt32LE(entry + 8)
      const offset = bytes.readUInt32LE(entry + 12)
      if (offset < tableEnd || size > bytes.length - offset) {
        return null
      }
      images.push(bytes.subarray(offset, offset + size))
    }
  } else {
    return bytes
  }
  return (
    images
      .map((image) => ({ image, dimensions: readRasterImageDimensions(image) }))
      .filter((entry) => entry.dimensions !== null)
      .sort((a, b) => (b.dimensions?.width ?? 0) - (a.dimensions?.width ?? 0))[0]?.image ?? null
  )
}
