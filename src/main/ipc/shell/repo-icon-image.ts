import { nativeImage } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { readAppIconRaster } from '../../window/desktop-integration/app-icon-container'
import { readRasterImageDimensions } from '../../../shared/file-preview/raster-image-dimensions'
import { MAX_REPO_ICON_UPLOAD_BYTES } from '../../../shared/repository/appearance/repo-icon'
import {
  repoIconPickFailure,
  type RepoIconPickResult
} from '../../../shared/repository/appearance/repo-icon-pick-failure-copy'

export const REPO_ICON_FILE_EXTENSIONS = ['png', 'icns']
const MAX_ICNS_BYTES = 10 * 1024 * 1024

export async function readRepoIconImage(filePath: string): Promise<RepoIconPickResult> {
  const extension = extname(filePath).toLowerCase()
  if (!REPO_ICON_FILE_EXTENSIONS.includes(extension.slice(1))) {
    return repoIconPickFailure('unsupportedFormat')
  }
  const limit = extension === '.icns' ? MAX_ICNS_BYTES : MAX_REPO_ICON_UPLOAD_BYTES
  if ((await stat(filePath)).size > limit) {
    return repoIconPickFailure(extension === '.icns' ? 'icnsTooLarge' : 'tooLarge')
  }
  let bytes: Buffer = await readFile(filePath)
  if (bytes.length > limit) {
    return repoIconPickFailure(extension === '.icns' ? 'icnsTooLarge' : 'tooLarge')
  }
  if (extension === '.icns') {
    const raster = readAppIconRaster(bytes)
    const dimensions = raster && readRasterImageDimensions(raster)
    if (!raster || !dimensions || dimensions.width > 2048 || dimensions.height > 2048) {
      return repoIconPickFailure('invalidImage')
    }
    const image = nativeImage.createFromBuffer(raster)
    if (image.isEmpty()) {
      return repoIconPickFailure('invalidImage')
    }
    bytes = image.resize({ width: 128, height: 128, quality: 'best' }).toPNG()
  }
  if (bytes.length > MAX_REPO_ICON_UPLOAD_BYTES) {
    return repoIconPickFailure('tooLarge')
  }
  return {
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
    fileName: basename(filePath)
  }
}
