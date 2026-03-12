import React from 'react';

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

export default function TaskCard({ task, onEdit, onDelete }) {
  return (
    <div
      className="task-card"
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
