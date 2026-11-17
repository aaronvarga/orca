import { contrastRatio, hexToRgb } from '../../color/rgba-contrast'
import { resolveRepoBadgeColor } from './repo-badge-color'

export function resolveRepoIconColors(value: unknown): { background: string; foreground: string } {
  const background = resolveRepoBadgeColor(value)
  return {
    background,
    foreground: contrastRatio(hexToRgb(background), [0, 0, 0, 1]) >= 4.5 ? 'black' : 'white'
  }
}
