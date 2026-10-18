import { useEffect, useRef } from "react";

/** daisyUI modal confirmation driven by the `open` prop. */
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onClose,
}) {
  const dialog = useRef(null);

  useEffect(() => {
    if (open && !dialog.current.open) {
      dialog.current.showModal();
    } else if (!open && dialog.current.open) {
      dialog.current.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="modal modal-bottom sm:modal-middle"
      onClose={onClose}
    >
      <div className="modal-box">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm} disabled={busy}>
            {busy && <span className="loading loading-spinner loading-sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

export default ConfirmDialog;
