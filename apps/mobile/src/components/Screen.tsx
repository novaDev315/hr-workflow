import type { ReactNode } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { colors, spacing } from '../theme'

interface ScreenProps {
  children: ReactNode
  /** Wrap content in a ScrollView (default). Use false for FlatList/SectionList screens. */
  scroll?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
  edges?: Edge[]
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accentStrong}
                colors={[colors.accentStrong]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

export const screenPadding = spacing.lg

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
})
