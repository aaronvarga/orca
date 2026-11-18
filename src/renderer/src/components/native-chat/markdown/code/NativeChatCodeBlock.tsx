import { CodeBlock } from '../../beautiful-ui/CodeBlock'
// @protected-copy: preserve code controls used by approval prompts.
import React, { useContext } from 'react'
import { WrapText } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/class-names'
import { getCodeFenceLanguageLabel } from './code-fence-language-label'
import { NativeChatCopyButton } from '../../messages/actions/NativeChatCopyButton'
import { NativeChatMarkdownRowKeyContext } from '../native-chat-markdown-row-identity'
import { useNativeChatDisclosure } from '../../messages/disclosure/native-chat-disclosure-store'
import { NativeChatHighlightedCode } from './NativeChatHighlightedCode'

/** Code fences need their own copy target rather than the whole chat message. */
export function NativeChatCodeBlock({
  children,
  language,
  sourceLine,
  plain = false
}: {
  children?: React.ReactNode
  language?: string
  sourceLine?: number
  plain?: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const code = extractCodeText(children)
  const rowKey = useContext(NativeChatMarkdownRowKeyContext)
  // Keep wrap state in the transcript store so windowing and streaming block recuts cannot reset it; never persist it.
  const { open: wrapped, setOpen: setWrapped } = useNativeChatDisclosure(
    rowKey === undefined || sourceLine === undefined
      ? undefined
      : `code-wrap:${rowKey}:${sourceLine}`,
    false
  )
  const actions = code ? (
    <>
      <NativeChatCodeWrapButton wrapped={wrapped} onToggle={() => setWrapped(!wrapped)} />
      <NativeChatCopyButton text={code} label={t('components.native-chat.copyCode', 'Copy code')} />
    </>
  ) : null

  return (
    <CodeBlock
      data-native-chat-code-block={code ? '' : undefined}
      label={language ? getCodeFenceLanguageLabel(language) : undefined}
      language={language}
      actions={actions}
      code={code}
      wrapped={wrapped}
    >
      <pre
        data-native-chat-code-content
        className={cn(
          'm-0 min-w-0 flex-1 px-3.5 py-3 font-mono text-chat-code text-chat-code-foreground',
          wrapped
            ? 'whitespace-pre-wrap [overflow-wrap:anywhere]'
            : 'overflow-x-auto scrollbar-sleek'
        )}
      >
        {language && code && !plain ? (
          <code>
            <NativeChatHighlightedCode code={code} language={language} />
          </code>
        ) : (
          children
        )}
      </pre>
    </CodeBlock>
  )
}

function NativeChatCodeWrapButton({
  wrapped,
  onToggle
}: {
  wrapped: boolean
  onToggle: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const label = wrapped
    ? t('components.native-chat.disableLineWrap', 'Disable line wrap')
    : t('components.native-chat.wrapLines', 'Wrap lines')
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={wrapped}
      title={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-chat-foreground-faint transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground"
    >
      <WrapText className="size-3.5" />
    </button>
  )
}

/** For dimmed rows: their code keeps the row's faint color, so it is not tokenized at all. */
export function NativeChatPlainCodeBlock(props: {
  children?: React.ReactNode
  language?: string
  sourceLine?: number
}): React.JSX.Element {
  return <NativeChatCodeBlock {...props} plain />
}

function extractCodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractCodeText).join('')
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractCodeText(node.props.children)
  }
  return ''
}
