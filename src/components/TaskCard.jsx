import React from 'react';

/**
 * Formats a date string into relative time (e.g., "2h ago", "3d ago").
 * @param {string} dateStr - ISO date string
 * @returns {string} Relative time string
 */
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
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Checks if a due date is in the past.
 * @param {string} dueDate - ISO date string (YYYY-MM-DD)
 * @returns {boolean}
 */
function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

/**
 * Formats a due date for display.
 * @param {string} dueDate - ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
function formatDueDate(dueDate) {
  if (!dueDate) return '';
  const date = new Date(dueDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return `${diff}d left`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * TaskCard — Displays an individual task with drag-and-drop support.
 *
 * @param {{ task: object, onEdit: function, onDelete: function }} props
 */
export default function TaskCard({ task, onEdit, onDelete }) {
  const overdue = task.status !== 'done' && isOverdue(task.due_date);

  return (
    <div
      className={`task-card ${overdue ? 'task-card-overdue' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify(task));
        e.currentTarget.classList.add('dragging');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
    >
      <div className="task-card-header">
        <span className="task-card-title">{task.title}</span>
        <span className={`badge ${task.priority}`}>{task.priority}</span>
      </div>

      {task.description && (
        <p className="task-card-desc">{task.description}</p>
      )}

      <div className="task-card-footer">
        <div className="task-card-meta">
          {task.label && <span className="label-badge">{task.label}</span>}
          {task.due_date && (
            <span className={`due-badge ${overdue ? 'overdue' : ''}`}>
              📅 {formatDueDate(task.due_date)}
            </span>
          )}
          <span className="task-card-time" title={task.created_at}>
            {timeAgo(task.created_at)}
          </span>
        </div>
        <div className="task-card-actions">
          <button
            className="btn-icon"
            onClick={() => onEdit?.(task)}
            title="Edit task"
            aria-label="Edit task"
          >
            ✏️
          </button>
          <button
            className="btn-icon"
            onClick={() => onDelete?.(task)}
            title="Delete task"
            aria-label="Delete task"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
