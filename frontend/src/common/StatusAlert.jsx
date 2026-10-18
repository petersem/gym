import { useEffect } from "react";

/**
 * daisyUI alert for a status message string; renders nothing when empty.
 * Pass autoHideMs with onClose to dismiss the alert automatically.
 */
function StatusAlert({ message, type = "error", onClose, autoHideMs }) {
  useEffect(() => {
    if (!message || !autoHideMs || !onClose) {
      return;
    }
    const timer = setTimeout(onClose, autoHideMs);
    return () => clearTimeout(timer);
    // Restart the timer only when a new message is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, autoHideMs]);

  if (!message) {
    return null;
  }
  const style = {
    error: "alert-error",
    success: "alert-success",
    info: "alert-info",
    warning: "alert-warning",
  }[type];

  return (
    <div role="alert" className={`alert alert-soft ${style}`}>
      <span>{message}</span>
      {onClose && (
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onClose}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default StatusAlert;
