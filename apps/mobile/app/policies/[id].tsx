import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { Linking, StyleSheet, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { POLICIES_QUERY, type PolicyDocument } from '../../src/lib/queries'
import { formatLongDate } from '../../src/lib/format'
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  Screen,
  ScreenHeader,
} from '../../src/components'
import { safeDocumentUrl } from '../../src/lib/urls'
import { spacing, type } from '../../src/theme'

export default function PolicyDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, loading, error, refetch } = useQuery<{ policyDocuments: PolicyDocument[] }>(POLICIES_QUERY)
  const [openError, setOpenError] = useState<string | null>(null)
  const back = () => (router.canGoBack() ? router.back() : router.replace('/policies'))
  const policy = data?.policyDocuments.find((item) => item.id === id) ?? null

  if (!policy) {
    return (
      <Screen>
        <ScreenHeader title="Policy" onBack={back} />
        {error && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={loading} />
        ) : loading ? (
          <LoadingState label="Loading policy" />
        ) : (
          <EmptyState icon="book-open-variant" title="Policy not found" message="It may have been archived by HR." />
        )}
      </Screen>
    )
  }

  const documentUrl = safeDocumentUrl(policy.documentUrl)
  const openDocument = async () => {
    if (!documentUrl) return
    setOpenError(null)
    try {
      await Linking.openURL(documentUrl)
    } catch {
      setOpenError("We couldn't open the document on this device.")
    }
  }

  return (
    <Screen>
      <ScreenHeader eyebrow={policy.category} title={policy.title} onBack={back} />

      {policy.description ? <Text style={styles.lead}>{policy.description}</Text> : null}

      <Card flush>
        <DetailRow label="Version" value={policy.version} />
        <DetailRow label="Effective from" value={formatLongDate(policy.effectiveDate)} last />
      </Card>

      {policy.content ? (
        <Card>
          <Text style={styles.body} selectable>
            {policy.content}
          </Text>
        </Card>
      ) : null}

      {openError ? <Notice tone="danger" message={openError} /> : null}
      {documentUrl ? (
        <Button
          label={policy.documentOriginalName ? `Open ${policy.documentOriginalName}` : 'Open document'}
          icon="open-in-new"
          variant="secondary"
          onPress={openDocument}
          accessibilityHint="Opens the policy document in your browser"
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  lead: {
    ...type.body,
    fontSize: 17,
    lineHeight: 24,
  },
  body: {
    ...type.body,
    lineHeight: 24,
    marginVertical: spacing.xs,
  },
})
