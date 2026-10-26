import { useMemo, type ReactElement } from 'react'
import { useQuery } from '@apollo/client'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { POLICIES_QUERY, type PolicyDocument } from '../../src/lib/queries'
import { useRefresh } from '../../src/lib/use-refresh'
import { formatLongDate } from '../../src/lib/format'
import { EmptyState, ErrorState, LoadingState, Screen, ScreenHeader } from '../../src/components'
import { colors, radii, spacing, type } from '../../src/theme'

export default function PoliciesScreen() {
  const router = useRouter()
  const { data, loading, error, refetch } = useQuery<{ policyDocuments: PolicyDocument[] }>(POLICIES_QUERY)
  const { refreshing, onRefresh } = useRefresh(refetch)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))

  const policies = useMemo(
    () =>
      (data?.policyDocuments ?? [])
        .filter((policy) => !policy.status || policy.status.toUpperCase() === 'PUBLISHED')
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
    [data],
  )

  let emptyContent: ReactElement | null = null
  if (error && !data) {
    emptyContent = <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
  } else if (loading && !data) {
    emptyContent = <LoadingState label="Loading policies" />
  } else if (policies.length === 0) {
    emptyContent = (
      <EmptyState
        icon="book-open-variant"
        title="No policies published yet"
        message="Policies appear here once HR publishes them."
      />
    )
  }

  return (
    <Screen scroll={false}>
      <FlatList
        data={emptyContent ? [] : policies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title="Policies" subtitle="Published company policies." onBack={back} />
          </View>
        }
        ListEmptyComponent={emptyContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentStrong}
            colors={[colors.accentStrong]}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.navigate(`/policies/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.category}, version ${item.version}`}
            accessibilityHint="Opens the policy"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.main}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                Version {item.version} · Effective {formatLongDate(item.effectiveDate)}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  separator: {
    height: spacing.sm,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  category: {
    ...type.caption,
    fontWeight: '600',
    color: colors.accentStrong,
  },
  title: {
    ...type.bodyStrong,
  },
  meta: {
    ...type.caption,
  },
})
