import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Formats a date string into relative time (e.g., "2h ago", "3d ago").
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

function isOverdue(dueDate) {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

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
 * TaskCard — Displays an individual task with drag-and-drop and batch selection support.
 */
const TaskCard = React.memo(function TaskCard({ task, index, onEdit, onDelete, onMove, batchMode, selected, onToggleSelect, style }) {
  const overdue = task.status !== 'done' && isOverdue(task.due_date);

  const handleClick = () => {
    if (batchMode) {
      onToggleSelect?.(task.id);
    }
  };

  // Quick action status options (exclude current status)
  const quickActions = [
    { status: 'todo', label: 'To Do' },
    { status: 'inprogress', label: 'In Progress' },
    { status: 'done', label: 'Done' }
  ].filter(a => a.status !== task.status);

  return (
    <Draggable draggableId={String(task.id)} index={index} isDragDisabled={batchMode}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${overdue ? 'task-card-overdue' : ''} ${selected ? 'task-card-selected' : ''} ${snapshot.isDragging ? 'dragging' : ''}`}
          data-priority={task.priority}
          style={{ ...style, ...provided.draggableProps.style }}
          role="article"
          aria-label={`Task: ${task.title}`}
          onClick={handleClick}
        >
          {batchMode && (
        <div className="task-card-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(task.id)}
            aria-label={`Select "${task.title}"`}
          />
        </div>
      )}
      <div className="task-card-header">
        <span className="task-card-title">{task.title}</span>
        <span className={`badge ${task.priority}`}>{task.priority}</span>
      </div>

      {task.description && (
        <div className="task-card-desc markdown-body preview-mini">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{task.description}</ReactMarkdown>
        </div>
      )}

      {task.subtask_total > 0 && (
        <div className="subtask-progress" aria-label={`${task.subtask_done} of ${task.subtask_total} subtasks done`}>
          <div className="subtask-progress-track">
            <div
              className="subtask-progress-fill"
              style={{ width: `${Math.round((task.subtask_done / task.subtask_total) * 100)}%` }}
            />
          </div>
          <span className="subtask-progress-text">
            ☐ {task.subtask_done}/{task.subtask_total}
          </span>
        </div>
      )}

      <div className="task-card-footer">
        <div className="task-card-meta">
          {task.label && <span className="label-badge">{task.label}</span>}
          {task.due_date && (
            <span className={`due-badge ${overdue ? 'overdue' : ''}`}>
              {formatDueDate(task.due_date)}
            </span>
          )}
          <span className="task-card-time" title={task.created_at}>
            {timeAgo(task.created_at)}
          </span>
        </div>
        {!batchMode && (
          <div className="task-card-actions">
            <button className="btn-icon" onClick={() => onEdit?.(task)} title="Edit task" aria-label="Edit task">✎</button>
            <button className="btn-icon" onClick={() => onDelete?.(task)} title="Delete task" aria-label="Delete task">×</button>
          </div>
        )}
      </div>

      {/* Quick status change actions */}
      {!batchMode && onMove && (
        <div className="task-card-quick-actions">
          {quickActions.map(a => (
            <button
              key={a.status}
              className={`quick-action-btn ${a.status === 'done' ? 'qa-done' : ''}`}
              onClick={(e) => { e.stopPropagation(); onMove(task.id, a.status); }}
              title={`Move to ${a.label}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
      )}
    </Draggable>
  );
});

export default TaskCard;
