import React, { useState, useEffect, useRef } from 'react';

const API = '/api';

/**
 * TaskModal — Create/edit task form with subtask checklist.
 *
 * A11y: role="dialog", aria-modal, focus trap, Escape to close,
 * focus returns to trigger element on close.
 *
 * @param {{ task: object|null, onSave: function, onClose: function }} props
 */
export default function TaskModal({ task, onSave, onClose, getHeaders }) {
  const defaultForm = { title: '', description: '', priority: 'medium', label: '', due_date: '', status: 'todo' };
  const [form, setForm] = useState(defaultForm);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const headers = getHeaders?.() || { 'Content-Type': 'application/json' };

  useEffect(() => {
    if (task && task.id) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        label: task.label || '',
        due_date: task.due_date || '',
        status: task.status || 'todo'
      });
      // Fetch subtasks for existing tasks
      fetch(`${API}/tasks/${task.id}/subtasks`, { headers })
        .then(r => r.json())
        .then(data => setSubtasks(Array.isArray(data) ? data : []))
        .catch(() => {});
      // Fetch comments
      fetch(`${API}/tasks/${task.id}/comments`, { headers })
        .then(r => r.json())
        .then(data => setComments(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      setForm(defaultForm);
      setSubtasks([]);
      setComments([]);
    }
  }, [task]);

  // Focus management
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const firstInput = modalRef.current?.querySelector('input, textarea, select');
    firstInput?.focus();
    return () => { previousFocusRef.current?.focus(); };
  }, []);

  // Keyboard: Escape + focus trap
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'input, textarea, select, button, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
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

  // Subtask handlers
  const addSubtask = async () => {
    if (!newSubtask.trim() || !task?.id) return;
    try {
      const res = await fetch(`${API}/tasks/${task.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSubtask.trim() })
      });
      if (res.ok) {
        const sub = await res.json();
        setSubtasks(prev => [...prev, sub]);
        setNewSubtask('');
      }
    } catch { /* ignore */ }
  };

  const toggleSubtask = async (subtaskId) => {
    try {
      const res = await fetch(`${API}/tasks/${task.id}/subtasks/${subtaskId}/toggle`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setSubtasks(prev => prev.map(s => s.id === subtaskId ? updated : s));
      }
    } catch { /* ignore */ }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await fetch(`${API}/tasks/${task.id}/subtasks/${subtaskId}`, { method: 'DELETE' });
      setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    } catch { /* ignore */ }
  };

  const handleSubtaskKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
  };

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
            {form.title.length > 0 && (
              <span className={`char-counter ${form.title.length > 180 ? 'warn' : ''}`}>
                {form.title.length}/200
              </span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="task-desc">Description</label>
            <textarea id="task-desc" className="form-textarea" value={form.description}
              onChange={set('description')} placeholder="Add details..." maxLength={2000} />
            {form.description.length > 0 && (
              <span className={`char-counter ${form.description.length > 1800 ? 'warn' : ''}`}>
                {form.description.length}/2000
              </span>
            )}
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
          <div className="form-group">
            <label htmlFor="task-due">Due Date</label>
            <input id="task-due" type="date" className="form-input" value={form.due_date}
              onChange={set('due_date')} />
            <div className="date-shortcuts">
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: 'Next Week', days: 7 }
              ].map(({ label, days }) => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                const val = d.toISOString().split('T')[0];
                return (
                  <button key={label} type="button" className="btn btn-sm btn-ghost date-shortcut"
                    onClick={() => setForm(f => ({ ...f, due_date: val }))}>{label}</button>
                );
              })}
              {form.due_date && (
                <button type="button" className="btn btn-sm btn-ghost date-shortcut"
                  onClick={() => setForm(f => ({ ...f, due_date: '' }))}>✕ Clear</button>
              )}
            </div>
          </div>

          {/* Subtask checklist — only for existing tasks */}
          {task?.id && (
            <div className="form-group">
              <label>Subtasks</label>
              <div className="subtask-list">
                {subtasks.map(sub => (
                  <div key={sub.id} className="subtask-item">
                    <label className="subtask-check">
                      <input
                        type="checkbox"
                        checked={!!sub.completed}
                        onChange={() => toggleSubtask(sub.id)}
                      />
                      <span className={sub.completed ? 'subtask-done' : ''}>{sub.title}</span>
                    </label>
                    <button
                      type="button"
                      className="btn-icon subtask-delete"
                      onClick={() => deleteSubtask(sub.id)}
                      aria-label={`Delete subtask: ${sub.title}`}
                    >×</button>
                  </div>
                ))}
                <div className="subtask-add">
                  <input
                    className="form-input form-input-sm"
                    placeholder="Add a subtask..."
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={handleSubtaskKeyDown}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={addSubtask}
                    disabled={!newSubtask.trim()}
                  >Add</button>
                </div>
              </div>
            </div>
          )}

          {/* Comments section — only for existing tasks */}
          {task?.id && (
            <div className="form-group">
              <label>💬 Comments ({comments.length})</label>
              <div className="comment-thread">
                {comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-header">
                      <span className="comment-author">{c.username || 'Anonymous'}</span>
                      <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
                      <button
                        type="button"
                        className="btn-icon comment-delete"
                        onClick={async () => {
                          await fetch(`${API}/tasks/${task.id}/comments/${c.id}`, { method: 'DELETE', headers });
                          setComments(prev => prev.filter(x => x.id !== c.id));
                        }}
                        aria-label="Delete comment"
                      >×</button>
                    </div>
                    <p className="comment-body">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && <p className="comment-empty">No comments yet</p>}
                <div className="comment-add">
                  <input
                    className="form-input form-input-sm"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    maxLength={2000}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && newComment.trim()) {
                        e.preventDefault();
                        const res = await fetch(`${API}/tasks/${task.id}/comments`, {
                          method: 'POST', headers,
                          body: JSON.stringify({ content: newComment.trim() })
                        });
                        if (res.ok) {
                          const c = await res.json();
                          setComments(prev => [...prev, c]);
                          setNewComment('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={!newComment.trim()}
                    onClick={async () => {
                      if (!newComment.trim()) return;
                      const res = await fetch(`${API}/tasks/${task.id}/comments`, {
                        method: 'POST', headers,
                        body: JSON.stringify({ content: newComment.trim() })
                      });
                      if (res.ok) {
                        const c = await res.json();
                        setComments(prev => [...prev, c]);
                        setNewComment('');
                      }
                    }}
                  >Post</button>
                </div>
              </div>
            </div>
          )}

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
