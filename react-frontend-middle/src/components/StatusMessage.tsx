import type { ReactNode } from 'react'

export const LoadingState = ({ text = 'Загрузка…' }: { text?: string }) => {
  return (
    <div className="status-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) => {
  return (
    <div className="status-block status-block-error" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  )
}

export const EmptyState = ({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) => {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  )
}
