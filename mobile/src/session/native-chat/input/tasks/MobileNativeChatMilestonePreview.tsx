import { toolStyles } from '../../transcript/tool-results/mobile-native-chat-tool-styles'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { MobileMarkdown } from '../../../../components/markdown/MobileMarkdown'
import { filePreviewTextRead } from '../../../../files/preview/mobile-file-preview-operations'
import type { RpcClient } from '../../../../transport/rpc/rpc-client-contract'
import { useMobileTranslation } from '../../../../i18n/use-mobile-translation'
import { chatScratchFileAddress } from '../../../../../../src/shared/native-chat/input/chat-scratch-file-address'

export function MobileNativeChatMilestonePreview({
  client,
  filePath
}: {
  client: RpcClient
  filePath: string
}) {
  const t = useMobileTranslation()
  const [content, setContent] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [failed, setFailed] = useState(false)
  const toggle = async () => {
    if (content !== null) {
      setContent(null)
      return
    }
    const address = chatScratchFileAddress(filePath)
    if (!address) {
      return
    }
    setReading(true)
    setFailed(false)
    try {
      const result = filePreviewTextRead.interpret(
        await filePreviewTextRead.request(client, {
          worktree: address.worktreeSelector,
          relativePath: address.relativePath
        })
      )
      if (!result.accepted) {
        throw new Error('Milestone preview refused')
      }
      setContent(result.value.content)
    } catch {
      setFailed(true)
    } finally {
      setReading(false)
    }
  }
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: content !== null, disabled: reading }}
        disabled={reading}
        onPress={() => void toggle()}
      >
        <Text style={toolStyles.lineMeta}>
          {reading
            ? t('components.native-chat.milestones.opening', 'Opening…')
            : t('components.native-chat.milestones.preview', 'Markdown preview')}
        </Text>
      </Pressable>
      {failed ? (
        <Text style={toolStyles.lineMeta} accessibilityRole="alert">
          {t(
            'components.native-chat.milestones.readError',
            'Markdown preview could not be opened. Try again.'
          )}
        </Text>
      ) : null}
      {content !== null ? <MobileMarkdown content={content} /> : null}
    </View>
  )
}
