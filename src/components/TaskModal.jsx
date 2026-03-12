import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * TaskModal — Create/edit task form with accessibility features.
 *
 * A11y: role="dialog", aria-modal, focus trap, Escape to close,
 * focus returns to trigger element on close.
 *
 * @param {{ task: object|null, onSave: function, onClose: function }} props
 */
export default function TaskModal({ task, onSave, onClose }) {
  const defaultForm = { title: '', description: '', priority: 'medium', label: '', status: 'todo' };
  const [form, setForm] = useState(defaultForm);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (task && task.id) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        label: task.label || '',
        status: task.status || 'todo'
      });
    } else {
      setForm(defaultForm);
    }
  }, [task]);

  // Focus management: save previous focus, restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const firstInput = modalRef.current?.querySelector('input, textarea, select');
    firstInput?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Keyboard: Escape to close + focus trap
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Focus trap: Tab cycles within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, id: task?.id });
  };

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title">{task?.id ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="task-title">Title</label>
            <input id="task-title" className="form-input" value={form.title} onChange={set('title')}
              placeholder="What needs to be done?" autoFocus maxLength={200} required />
          </div>
          <div className="form-group">
            <label htmlFor="task-desc">Description</label>
            <textarea id="task-desc" className="form-textarea" value={form.description}
              onChange={set('description')} placeholder="Add details..." maxLength={2000} />
          </div>
          <div className="form-group">
            <label htmlFor="task-priority">Priority</label>
            <select id="task-priority" className="form-select" value={form.priority} onChange={set('priority')}>
              <option value="low">🟢 Low</option>
              <option value="medium">🔵 Medium</option>
              <option value="high">🟡 High</option>
              <option value="urgent">🔴 Urgent</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-label">Label</label>
            <input id="task-label" className="form-input" value={form.label} onChange={set('label')}
              placeholder="e.g. bug, feature, docs" maxLength={50} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!form.title.trim()}>
              {task?.id ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
