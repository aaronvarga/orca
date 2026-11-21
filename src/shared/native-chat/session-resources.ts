import { filePreviewExtension, filePreviewForPath } from '../file-preview/file-preview-kind'
import type { NativeChatEditChangeKind } from './tools/native-chat-edit-model'
import type { NativeChatMessage, NativeChatToolCallBlock } from './native-chat-types'
import {
  editFilesFromPatchText,
  isNativeChatFileCountPath
} from './tools/native-chat-edit-patch-files'
import { buildEditSummaries } from './tools/native-chat-edit-cards'
import { pairToolBlocks } from './tools/native-chat-tool-pairs'
import { nativeChatToolCategory } from './tools/native-chat-tool-icon'
import { toolFilePath } from './tools/native-chat-tool-summary'
import { toolWebSearchResults } from './tools/native-chat-tool-identity'
import { nativeChatTextAttachmentPaths } from './attachments/native-chat-text-attachment-references'
import { extractTerminalHttpLinks } from '../terminal/links/terminal-http-url-extraction'
import { detectTerminalFileUriLinks } from '../terminal/links/terminal-file-uri-link'
import { detectTerminalMarkdownFileLinks } from '../terminal/links/terminal-markdown-file-links'
import { createNativeChatFileHref } from './file-access/native-chat-href-routing'

export type SessionResource = {
  href: string
  label: string
  detail: string
  kind: 'file' | 'web' | 'image'
  change?: NativeChatEditChangeKind
}
export type SessionResources = {
  outputs: SessionResource[]
  links: SessionResource[]
  changedFiles: SessionResource[]
  uploads: SessionResource[]
  sources: SessionResource[]
  browserCalls: NativeChatToolCallBlock[]
}

const OUTPUT_DOCUMENT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.rtf',
  '.doc',
  '.docx',
  '.odt',
  '.csv',
  '.tsv',
  '.xls',
  '.xlsx',
  '.ods',
  '.ppt',
  '.pptx',
  '.odp',
  '.html',
  '.htm'
])

function webResource(url: unknown, title?: string): SessionResource | null {
  const result = toolWebSearchResults([{ url, title }])[0]
  return result
    ? {
        href: result.url,
        label: title ? result.title : new URL(result.url).hostname,
        detail: result.url,
        kind: 'web'
      }
    : null
}

function fileResource(path: string): SessionResource {
  return {
    href: createNativeChatFileHref(path, 'literal'),
    label: path.split(/[\\/]/).at(-1) || path,
    detail: path,
    kind: 'file'
  }
}

/** Linked documents and media identify outputs; code links and line citations remain references. */
export function collectSessionResources(messages: readonly NativeChatMessage[]): SessionResources {
  const outputs = new Map<string, SessionResource>()
  const changedFiles = new Map<string, SessionResource>()
  const links = new Map<string, SessionResource>()
  const uploads = new Map<string, SessionResource>()
  const sources = new Map<string, SessionResource>()
  const browserCalls: NativeChatToolCallBlock[] = []
  const blocks = messages.flatMap((message) => message.blocks)
  for (const { files } of buildEditSummaries(blocks).values()) {
    for (const file of files) {
      const entry = { ...fileResource(file.path), change: file.changeKind }
      changedFiles.set(entry.href, entry)
    }
  }
  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.type === 'image-ref') {
        const entry = block.path
          ? { ...fileResource(block.path), kind: 'image' as const }
          : webResource(block.url, block.alt)
        if (entry) {
          ;(message.role === 'user' ? uploads : sources).set(entry.href, entry)
        }
      }
      if (message.role === 'assistant' && block.type === 'text') {
        const markdown = detectTerminalMarkdownFileLinks(block.text)
        for (const link of [
          ...markdown.links,
          ...detectTerminalFileUriLinks(markdown.remainingText)
        ]) {
          const entry = fileResource(link.pathText)
          if (
            link.line == null &&
            (filePreviewForPath(link.pathText) ||
              OUTPUT_DOCUMENT_EXTENSIONS.has(filePreviewExtension(link.pathText)))
          ) {
            outputs.set(entry.href, entry)
          }
          links.set(entry.href, entry)
        }
        for (const { url } of extractTerminalHttpLinks(block.text)) {
          const entry = webResource(url)
          if (entry) {
            links.set(entry.href, entry)
          }
        }
      }
      if (message.role === 'user' && block.type === 'text') {
        for (const path of nativeChatTextAttachmentPaths(block.text, true)) {
          const entry = fileResource(path)
          uploads.set(entry.href, entry)
        }
      }
    }
  }
  for (const { call, result } of pairToolBlocks(blocks)) {
    if (
      !call ||
      call.state === 'failed' ||
      call.state === 'running' ||
      result?.isError ||
      (call.state !== 'completed' && !result)
    ) {
      continue
    }
    const category = nativeChatToolCategory(call.name, call.mcpIdentity, call.input)
    if (
      call.name === 'Diff' &&
      result &&
      isNativeChatFileCountPath(toolFilePath(call.input) ?? '')
    ) {
      for (const file of editFilesFromPatchText(result.output, null, true) ?? []) {
        const entry = { ...fileResource(file.path), change: file.changeKind }
        changedFiles.set(entry.href, entry)
      }
    }
    if (category === 'browser') {
      browserCalls.push(call)
    }
    if (category === 'read') {
      const path = toolFilePath(call.input)
      if (path) {
        const entry = fileResource(path)
        sources.set(entry.href, entry)
      }
    }
    if (call.name === 'WebSearch' && result) {
      for (const { url } of extractTerminalHttpLinks(result.output).slice(0, 50)) {
        const entry = webResource(url)
        if (entry && !sources.has(entry.href)) {
          sources.set(entry.href, entry)
        }
      }
    }
    for (const hit of toolWebSearchResults(call.webSearchResults)) {
      const entry = webResource(hit.url, hit.title)
      if (entry) {
        sources.set(entry.href, entry)
      }
    }
    if (
      (category === 'webSearch' || category === 'browser') &&
      call.input &&
      typeof call.input === 'object'
    ) {
      const entry = webResource('url' in call.input ? call.input.url : undefined)
      if (entry && !sources.has(entry.href)) {
        sources.set(entry.href, entry)
      }
    }
  }
  for (const [href, entry] of outputs) {
    const change = changedFiles.get(href)
    if (change?.change === 'deleted') {
      outputs.delete(href)
      continue
    }
    outputs.set(href, change ?? entry)
    changedFiles.delete(href)
    sources.delete(href)
  }
  for (const href of changedFiles.keys()) {
    sources.delete(href)
  }
  return {
    links: [...links.values()],
    changedFiles: [...changedFiles.values()],
    outputs: [...outputs.values()],
    uploads: [...uploads.values()],
    sources: [...sources.values()],
    browserCalls
  }
}
