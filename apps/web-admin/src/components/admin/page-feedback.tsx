import { Notice } from '@/components/ui/notice'

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
      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      {statusMessage ? <Notice tone="success">{statusMessage}</Notice> : null}
      {loadError ? (
        <Notice tone="danger">
          {loadErrorPrefix ? `${loadErrorPrefix} ` : ''}
          {loadError.message}
        </Notice>
      ) : null}
    </>
  )
}
