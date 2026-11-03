/**
 * Shown in place of a loading spinner when the initial load failed. The parent
 * retries automatically; the button retries immediately.
 *
 * @param {{message: string, onRetry: () => void}} props
 */
function LoadFailed({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="alert alert-error alert-soft self-center flex-col sm:flex-row"
    >
      <span>{message} Retrying automatically…</span>
      <button type="button" className="btn btn-sm" onClick={onRetry}>
        Retry now
      </button>
    </div>
  );
}

export default LoadFailed;
