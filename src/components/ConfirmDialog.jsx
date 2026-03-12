import React, { useEffect, useRef } from 'react';

/**
 * ConfirmDialog — Accessible confirmation dialog using role="alertdialog".
 *
 * A11y: role="alertdialog", aria-describedby, auto-focuses cancel button
 * (safe default per WCAG guidelines), Escape to cancel.
 *
 * @param {{ title: string, message: string, confirmLabel: string, cancelLabel: string, onConfirm: function, onCancel: function, variant: string }} props
 */
export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, variant }) {
  const cancelRef = useRef(null);

  // Auto-focus cancel button (safe default)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape to cancel
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="confirm-icon" aria-hidden="true">
          {variant === 'danger' ? '⚠️' : 'ℹ️'}
        </div>
        <h2 id="confirm-title">{title || 'Are you sure?'}</h2>
        <p id="confirm-message" className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button ref={cancelRef} className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel || 'Cancel'}
          </button>
          <button
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
