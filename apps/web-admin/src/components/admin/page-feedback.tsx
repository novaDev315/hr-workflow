import { Notice } from '@/components/ui/notice'
import { readableError } from '@/lib/graphql-errors'

type PageFeedbackProps = {
  errorMessage?: string | null
  statusMessage?: string | null
  loadError?: Error | { message: string } | null
  loadErrorPrefix?: string
}

export function PageFeedback({
  errorMessage,
  statusMessage,
  loadError,
  loadErrorPrefix,
}: PageFeedbackProps) {
  return (
    <>
      {errorMessage ? (
        <Notice tone="danger" role="alert">
          {errorMessage}
        </Notice>
      ) : null}
      {statusMessage ? (
        <Notice tone="success" role="status">
          {statusMessage}
        </Notice>
      ) : null}
      {loadError ? (
        <Notice tone="danger" role="alert">
          {loadErrorPrefix ? `${loadErrorPrefix} ` : ''}
          {readableError(loadError)}
        </Notice>
      ) : null}
    </>
  )
}
