import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = '/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
  const [activityLogs, setActivityLogs] = useState([]);
  const [previewDesc, setPreviewDesc] = useState(false);
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
      fetch(`${API}/tasks/${task.id}/subtasks`, { headers, credentials: 'include' })
        .then(r => r.json())
        .then(data => setSubtasks(Array.isArray(data) ? data : []))
        .catch(() => {});
      // Fetch comments
      fetch(`${API}/tasks/${task.id}/comments`, { headers, credentials: 'include' })
        .then(r => r.json())
        .then(data => setComments(Array.isArray(data) ? data : []))
        .catch(() => {});
      // Fetch activity logs
      fetch(`${API}/tasks/${task.id}/activity`, { headers, credentials: 'include' })
        .then(r => r.json())
        .then(data => setActivityLogs(Array.isArray(data) ? data : []))
        .catch(() => {});
    } else {
      setForm(defaultForm);
      setSubtasks([]);
      setComments([]);
      setActivityLogs([]);
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
        credentials: 'include',
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
      const res = await fetch(`${API}/tasks/${task.id}/subtasks/${subtaskId}/toggle`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (res.ok) {
        const updated = await res.json();
        setSubtasks(prev => prev.map(s => s.id === subtaskId ? updated : s));
      }
    } catch { /* ignore */ }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await fetch(`${API}/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
    } catch { /* ignore */ }
  };

  const handleSubtaskKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addSubtask(); }
  };

  // Extracted comment posting (was duplicated in onKeyDown + onClick)
  const postComment = async () => {
    if (!newComment.trim() || !task?.id) return;
    try {
      const res = await fetch(`${API}/tasks/${task.id}/comments`, {
        method: 'POST', headers, credentials: 'include',
        body: JSON.stringify({ content: newComment.trim() })
      });
      if (res.ok) {
        const c = await res.json();
        setComments(prev => [...prev, c]);
        setNewComment('');
      }
    } catch { /* network error — silently fail */ }
  };

  const deleteComment = async (commentId) => {
    try {
      await fetch(`${API}/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE', headers, credentials: 'include'
      });
      setComments(prev => prev.filter(x => x.id !== commentId));
    } catch { /* network error */ }
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
        <h2 id="modal-title" className="modal-header-title">{task?.id ? 'Edit Task' : 'New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group floating">
            <input id="task-title" className="form-input" value={form.title} onChange={set('title')}
              placeholder=" " autoFocus maxLength={200} required />
            <label htmlFor="task-title">Task Title</label>
            {form.title.length > 0 && (
              <span className={`char-counter ${form.title.length > 180 ? 'warn' : ''}`}>
                {form.title.length}/200
              </span>
            )}
          </div>

          <div className="form-group markdown-editor-group">
            <label className="section-label">Description</label>
            <div className="markdown-tabs">
              <button
                type="button"
                className={`md-tab ${!previewDesc ? 'active' : ''}`}
                onClick={() => setPreviewDesc(false)}
              >
                ✏️ Write
              </button>
              <button
                type="button"
                className={`md-tab ${previewDesc ? 'active' : ''}`}
                onClick={() => setPreviewDesc(true)}
              >
                👁 Preview
              </button>
            </div>
            
            {!previewDesc ? (
              <div className="desc-editor-wrap">
                <textarea id="task-desc" className="form-textarea desc-textarea" value={form.description}
                  onChange={set('description')} placeholder="Write a description... (Markdown supported)" maxLength={2000} />
                {form.description.length > 0 && (
                  <span className={`char-counter ${form.description.length > 1800 ? 'warn' : ''}`}>
                    {form.description.length}/2,000
                  </span>
                )}
              </div>
            ) : (
              <div className="markdown-body preview-box">
                {form.description.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {form.description}
                  </ReactMarkdown>
                ) : (
                  <span className="empty-preview">Nothing to preview.</span>
                )}
              </div>
            )}
          </div>

          <div className="form-divider" />

          <div className="form-group">
            <label className="section-label">Priority</label>
            <div className="priority-selector">
              {[
                { val: 'low', icon: '🟢', label: 'Low' },
                { val: 'medium', icon: '🔵', label: 'Medium' },
                { val: 'high', icon: '🟡', label: 'High' },
                { val: 'urgent', icon: '🔴', label: 'Urgent' }
              ].map(p => (
                <button
                  key={p.val}
                  type="button"
                  className={`priority-btn ${form.priority === p.val ? 'active' : ''} prio-${p.val}`}
                  onClick={() => setForm(f => ({ ...f, priority: p.val }))}
                >
                  <span className="prio-icon">{p.icon}</span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-divider" />

          <div className="form-row">
            <div className="form-group form-group-half">
              <label htmlFor="task-label" className="section-label">Label</label>
              <input id="task-label" className="form-input" value={form.label} onChange={set('label')}
                placeholder="e.g. bug, feature, design" maxLength={50} />
            </div>

            <div className="form-group form-group-half">
              <label htmlFor="task-due" className="section-label">Due Date</label>
              <input id="task-due" type="date" className="form-input" value={form.due_date}
                onChange={set('due_date')} />
              <div className="date-shortcuts">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: '+1 Week', days: 7 }
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
                  <button type="button" className="btn btn-sm btn-ghost date-shortcut date-clear"
                    onClick={() => setForm(f => ({ ...f, due_date: '' }))}>✕</button>
                )}
              </div>
            </div>
          </div>

          {/* Subtask checklist — only for existing tasks */}
          {task?.id && (
            <>
            <div className="form-divider" />
            <div className="form-group">
              <label className="section-label">📋 Subtasks</label>
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
            </>
          )}

          {/* Comments section — only for existing tasks */}
          {task?.id && (
            <div className="form-group">
              <label className="section-label">💬 Comments ({comments.length})</label>
              <div className="comment-thread">
                {comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-header">
                      <span className="comment-author">{c.username || 'Anonymous'}</span>
                      <span className="comment-time">{timeAgo(c.created_at)}</span>
                      <button
                        type="button"
                        className="btn-icon comment-delete"
                        onClick={() => deleteComment(c.id)}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newComment.trim()) {
                        e.preventDefault();
                        postComment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={!newComment.trim()}
                    onClick={postComment}
                  >Post</button>
                </div>
              </div>
            </div>
          )}

          {/* Activity Timeline — only for existing tasks */}
          {task?.id && activityLogs.length > 0 && (
            <div className="form-group">
              <label className="section-label">📜 Activity History</label>
              <div className="activity-timeline">
                {activityLogs.map(log => (
                  <div key={log.id} className="activity-item">
                    <div className="activity-dot"></div>
                    <div className="activity-content">
                      <span className="activity-action">{log.details || log.action}</span>
                      <span className="activity-meta">
                        {timeAgo(log.created_at)} • {log.user_name || 'System'}
                      </span>
                    </div>
                  </div>
                ))}
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
