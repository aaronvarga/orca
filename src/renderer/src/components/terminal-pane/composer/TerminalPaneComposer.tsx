import { useTerminalComposerPaste } from './use-terminal-composer-paste'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useComposerDrafts } from './terminal-composer-drafts'
import { TerminalComposerTools } from './TerminalComposerTools'
import {
  prepareTerminalComposerFiles,
  type TerminalComposerTarget,
  type TerminalComposerAttachment
} from './terminal-composer-files'
import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Ellipsis, Expand, Minimize2, CircleX, X } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
const EMPTY_ATTACHMENTS: TerminalComposerAttachment[] = []

import type { TerminalComposerSendResult } from './terminal-composer-send'

export function TerminalPaneComposer({
  sessionKey,
  target,
  disabled = false,
  onSend,
  onFocusTerminal
}: {
  sessionKey: string
  target?: TerminalComposerTarget
  disabled?: boolean
  onSend: (text: string, submit: boolean) => Promise<TerminalComposerSendResult>
  onFocusTerminal: () => void
}) {
  const t = useTranslate()
  const profile = useAppStore((state) => state.activeOrcaProfileId) ?? 'default'
  const key = JSON.stringify([profile, sessionKey])
  const text = useComposerDrafts((state) => state.drafts[key] ?? '')
  const attachments = useComposerDrafts((state) => state.attachments[key] ?? EMPTY_ATTACHMENTS)
  const [preparing, setPreparing] = useState(false)
  const [clearAfter, setClearAfter] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) {
      return
    }
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, expanded ? 320 : 120)}px`
  }, [text, expanded])
  const updateDraft = (next: string) => {
    try {
      useComposerDrafts.getState().setDraft(key, next)
    } catch {
      setError(
        t(
          'terminalComposer.draftNotSaved',
          'Draft could not be saved on this device. Copy it before closing Orca.'
        )
      )
    }
  }
  const send = async (submit: boolean) => {
    if (disabled || preparing || sendingRef.current || (!text.trim() && !attachments.length)) {
      return
    }
    sendingRef.current = true
    setSending(true)
    setError(null)
    try {
      const result = await onSend(
        [...attachments.map((file) => file.text), text].filter(Boolean).join(' '),
        submit
      )
      if (result === 'sent' || result === 'inserted' || result === 'submit-failed') {
        if (clearAfter && useComposerDrafts.getState().drafts[key] === text) {
          updateDraft('')
          useComposerDrafts.getState().setAttachments(key, [])
        }
      }
      if (result === 'submit-failed') {
        setError(
          t(
            'terminalComposer.submitFailed',
            'Text was pasted, but Enter was not sent. Check the terminal before continuing.'
          )
        )
      } else if (result === 'paste-failed') {
        setError(
          t(
            'terminalComposer.pasteFailed',
            'Delivery stopped. Your draft is retained; check the terminal for partially pasted text before retrying.'
          )
        )
      }
    } catch {
      setError(
        t(
          'terminalComposer.pasteFailed',
          'Delivery stopped. Your draft is retained; check the terminal for partially pasted text before retrying.'
        )
      )
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }
  const sendLabel = t('terminalComposer.send', 'Send')
  const expandLabel = expanded
    ? t('terminalComposer.collapse', 'Collapse composer')
    : t('terminalComposer.expand', 'Expand composer')
  const attach = async (paths: string[]) => {
    if (!target || !paths.length) {
      return
    }
    setPreparing(true)
    setError(null)
    try {
      const files = await prepareTerminalComposerFiles(target, paths)
      useComposerDrafts.getState().setAttachments(key, [...attachments, ...files])
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t('terminalComposer.attachFailed', 'Could not attach files.')
      )
    } finally {
      setPreparing(false)
    }
  }
  const onPaste = useTerminalComposerPaste({
    inputRef,
    disabled: disabled || sending || preparing || !target,
    onAttach: attach,
    onError: setError
  })
  const tools = (
    <TerminalComposerTools
      target={target}
      disabled={disabled || sending || preparing}
      onAttach={attach}
      onInsert={(value) => {
        updateDraft(text ? `${text}\n${value}` : value)
        inputRef.current?.focus()
      }}
    />
  )
  const controls = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={expandLabel}
            aria-pressed={expanded}
            onClick={() => {
              setExpanded(!expanded)
              inputRef.current?.focus()
            }}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Expand className="size-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{expandLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('terminalComposer.clear', 'Clear')}
            disabled={sending || preparing || (!text && !attachments.length)}
            onClick={() => {
              updateDraft('')
              useComposerDrafts.getState().setAttachments(key, [])
              inputRef.current?.focus()
            }}
          >
            <CircleX className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('terminalComposer.clear', 'Clear')}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('terminalComposer.more', 'More composer actions')}
            disabled={disabled || sending || preparing}
          >
            <Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!text.trim() && !attachments.length}
            onSelect={() => void send(false)}
          >
            {t('terminalComposer.insert', 'Send without Enter')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={clearAfter} onCheckedChange={setClearAfter}>
            {t('terminalComposer.clearAfterSending', 'Clear after sending')}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            aria-label={sendLabel}
            disabled={disabled || sending || preparing || (!text.trim() && !attachments.length)}
            onClick={() => void send(true)}
          >
            <ArrowUp className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{sendLabel}</TooltipContent>
      </Tooltip>
    </>
  )
  const body = (
    <div
      data-pane-prevent-terminal-focus
      className="shrink-0 border-t border-border bg-card p-2 text-card-foreground"
      onKeyDown={(event) => event.stopPropagation()}
    >
      {expanded ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('terminalComposer.richInput', 'Rich input')}</span>
          <span className="min-w-0 flex-1 truncate">
            {t('terminalComposer.activePane', 'Active pane')}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('terminalComposer.close', 'Close composer')}
            onClick={() => setExpanded(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}
      {attachments.length ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {attachments.map((file) => (
            <div
              key={file.path}
              className="flex max-w-full items-center gap-1 rounded-md border border-border px-2 text-xs"
            >
              <span className="truncate">{file.path.split(/[\\/]/).pop()}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('terminalComposer.removeAttachment', 'Remove {{name}}', {
                  name: file.path
                })}
                onClick={() =>
                  useComposerDrafts.getState().setAttachments(
                    key,
                    attachments.filter((item) => item.path !== file.path)
                  )
                }
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      <div className={expanded ? 'flex flex-col gap-2' : 'flex items-end gap-1'}>
        {!expanded ? <div className="flex min-h-8 shrink-0 items-center">{tools}</div> : null}
        <Textarea
          ref={inputRef}
          onPaste={onPaste}
          variant="terminal-composer"
          rows={1}
          style={{ minHeight: expanded ? 160 : undefined }}
          aria-label={t('terminalComposer.input', 'Message to terminal')}
          placeholder={t('terminalComposer.placeholder', 'Type or speak…')}
          value={text}
          disabled={disabled || sending || preparing}
          className="min-h-8"
          onChange={(event) => {
            setError(null)
            updateDraft(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) {
              return
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(true)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              if (expanded) {
                setExpanded(false)
              } else {
                onFocusTerminal()
              }
            }
          }}
        />
        <div className="flex min-h-8 shrink-0 items-center">
          {expanded ? (
            <>
              {tools}
              <span className="min-w-0 flex-1" />
            </>
          ) : null}
          {controls}
        </div>
      </div>
      {error ? (
        <p role="alert" className="pt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
  if (!expanded) {
    return body
  }
  return (
    <>
      <div
        data-pane-prevent-terminal-focus
        className="border-t border-border bg-card p-2 text-card-foreground"
      >
        <Button variant="ghost" size="xs" onClick={() => setExpanded(true)}>
          {t('terminalComposer.richInput', 'Rich input')}
        </Button>
      </div>
      <Dialog open onOpenChange={setExpanded}>
        <DialogContent
          surface="panel"
          showCloseButton={false}
          className="sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
        >
          <DialogTitle className="sr-only">
            {t('terminalComposer.richInput', 'Rich input')}
          </DialogTitle>
          {body}
        </DialogContent>
      </Dialog>
    </>
  )
}
