import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import type { NativeChatBlock } from '../../../../../../shared/native-chat/native-chat-types'
import {
  nativeChatTurnDiffs,
  type NativeChatTurnDiffFile
} from '../../../../../../shared/native-chat/tools/native-chat-turn-diffs'
import { nativeChatEditFileBaseName } from '../../../../../../shared/native-chat/tools/native-chat-edit-model'
import { useNativeChatDisclosure } from '../../messages/disclosure/native-chat-disclosure-store'
import { NativeChatExpandable } from '../../messages/disclosure/NativeChatExpandable'
import { TurnDiffFilePatches } from './NativeChatTurnDiffRollup'

function FileChip({ file, disclosureId }: { file: NativeChatTurnDiffFile; disclosureId?: string }) {
  const t = useTranslate()
  const { open, setOpen } = useNativeChatDisclosure(
    disclosureId === undefined ? undefined : `file-chip:${disclosureId}:${file.path}`,
    false
  )
  return (
    <div className={cn('min-w-0 max-w-full', open && 'w-full')}>
      <Button
        variant="outline"
        size="chip"
        title={file.path}
        aria-label={`${file.path} +${file.added} -${file.removed}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="max-w-full justify-start"
      >
        <span className="flex min-w-0 items-center gap-2 font-mono text-chat-code">
          <span className="min-w-0 truncate">{nativeChatEditFileBaseName(file.path)}</span>
          {file.added > 0 ? <span className="text-chat-diff-added">+{file.added}</span> : null}
          {file.removed > 0 ? (
            <span className="text-chat-diff-removed">-{file.removed}</span>
          ) : null}
          {file.truncated ? (
            <span className="text-xs text-muted-foreground">
              {t('components.native-chat.turnDiff.partial', 'Partial diff')}
            </span>
          ) : null}
        </span>
      </Button>
      <NativeChatExpandable open={open}>
        <div className="py-2" data-native-chat-member-detail>
          <p className="break-all font-mono text-xs text-chat-foreground-faint">{file.path}</p>
          <TurnDiffFilePatches file={file} />
        </div>
      </NativeChatExpandable>
    </div>
  )
}

export function NativeChatFileChangeChips({
  blocks,
  disclosureId
}: {
  blocks: NativeChatBlock[]
  disclosureId?: string
}): React.JSX.Element | null {
  const t = useTranslate()
  const diff = useMemo(
    () => nativeChatTurnDiffs([{ id: disclosureId ?? 'run', blocks }], ['run']).get('run'),
    [blocks, disclosureId]
  )
  const { open: showAll, setOpen: setShowAll } = useNativeChatDisclosure(
    disclosureId === undefined ? undefined : `file-chips:${disclosureId}`,
    false
  )
  if (!diff?.files.length) {
    return null
  }
  const files = showAll ? diff.files : diff.files.slice(0, 3)
  const remaining = diff.files.length - files.length
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-start gap-1.5 border-t border-border pt-2">
      {files.map((file) => (
        <FileChip key={file.path} file={file} disclosureId={disclosureId} />
      ))}
      {remaining > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
          {t('components.native-chat.turnDiff.showMoreFiles', 'Show {{count}} more', {
            count: remaining
          })}
        </Button>
      ) : null}
    </div>
  )
}
