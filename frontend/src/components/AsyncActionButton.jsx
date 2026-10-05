export default function AsyncActionButton({ busy = false, busyLabel = 'Working…', children, disabled, ...props }) {
  return <button {...props} disabled={Boolean(disabled || busy)} data-action-disabled={disabled || busy ? 'true' : undefined} aria-busy={busy || undefined}>
    {busy && <span className="action-spinner" aria-hidden="true" />}
    <span>{busy ? busyLabel : children}</span>
  </button>
}
