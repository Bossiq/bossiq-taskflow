import React, { useCallback } from 'react';
import TaskCard from './TaskCard.jsx';

/** @constant {Array<{id: string, title: string, dot: string}>} COLUMNS — Kanban column definitions */
const COLUMNS = [
  { id: 'todo', title: 'To Do', dot: 'todo' },
  { id: 'inprogress', title: 'In Progress', dot: 'inprogress' },
  { id: 'done', title: 'Done', dot: 'done' }
];

/**
 * Board — Kanban board with drag-and-drop columns.
 *
 * A11y: Each column has role="region" and aria-label.
 * Drag feedback announced via aria-live region.
 *
 * @param {{ tasks: Array, onEdit: function, onDelete: function, onMove: function }} props
 */
export default function Board({ tasks, onEdit, onDelete, onMove }) {

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const handleDrop = useCallback((e, status) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    // Clean up all drag-over classes in case of edge cases
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    try {
      const task = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (task.status !== status) {
        onMove?.(task.id, status);
      }
    } catch (_) { /* ignore invalid drag data */ }
  }, [onMove]);

  return (
    <div className="board" role="group" aria-label="Kanban Board">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        return (
          <div
            className="column"
            key={col.id}
            role="region"
            aria-label={`${col.title} column — ${colTasks.length} tasks`}
          >
            <div className="column-header">
              <div className="column-title">
                <span className={`column-dot ${col.dot}`} aria-hidden="true" />
                {col.title}
                <span className="column-count" aria-label={`${colTasks.length} tasks`}>{colTasks.length}</span>
              </div>
            </div>
            <div
              className="column-cards"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {colTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
              {colTasks.length === 0 && (
                <p className="column-empty">
                  Drop tasks here
                </p>
              )}
            </div>
          </div>
        );
      })}
      {/* Screen reader announcement for drag operations */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="drag-announcement" />
    </div>
  );
}
