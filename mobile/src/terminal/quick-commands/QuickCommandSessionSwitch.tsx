import { View, Text } from 'react-native'
import { MobileSwitch } from '../../components/controls/MobileSwitch'
import { colors, spacing } from '../../theme/mobile-theme'
import { themedStyleSheet } from '../../theme/themed-styles'
import { useMobileColorScheme } from '../../theme/use-mobile-color-scheme'
import { useMobileTranslation } from '../../i18n/use-mobile-translation'

export function QuickCommandSessionSwitch({
  newSession,
  onChange
}: {
  newSession: boolean
  onChange: (value: boolean) => void
}) {
  useMobileColorScheme()
  const t = useMobileTranslation()
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>
          {t('session.quickCommandEditorForm.newSession', 'New session')}
        </Text>
        <Text style={styles.description}>
          {newSession
            ? t(
                'session.quickCommandEditorForm.startNew',
                'Start a new session for this quick command.'
              )
            : t(
                'session.quickCommandEditorForm.insertCurrent',
                'Insert into the current chat without sending.'
              )}
        </Text>
      </View>
      <MobileSwitch
        accessibilityLabel={t('session.quickCommandEditorForm.newSession', 'New session')}
        value={newSession}
        onValueChange={onChange}
      />
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
  title: { fontSize: 14, color: colors.textPrimary },
  description: { fontSize: 12, color: colors.textMuted, marginTop: 1 }
}))
