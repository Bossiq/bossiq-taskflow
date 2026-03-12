import React, { useState, useCallback, useMemo } from 'react';
import TaskCard from './TaskCard.jsx';

/** @constant COLUMNS — Kanban column definitions */
const COLUMNS = [
  { id: 'todo', title: 'To Do', dot: 'todo' },
  { id: 'inprogress', title: 'In Progress', dot: 'inprogress' },
  { id: 'done', title: 'Done', dot: 'done' }
];

/** Priority weights for sorting (higher = more urgent) */
const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };

/** Sort options available to the user */
const SORT_OPTIONS = [
  { value: 'priority', label: '🔥 Priority' },
  { value: 'due', label: '📅 Due Date' },
  { value: 'newest', label: '🕐 Newest' },
  { value: 'oldest', label: '📆 Oldest' },
  { value: 'alpha', label: '🔤 A–Z' }
];

/**
 * Sorts tasks based on the selected sort option.
 * @param {Array} tasks
 * @param {string} sortBy
 * @returns {Array} sorted tasks (new array)
 */
function sortTasks(tasks, sortBy) {
  const sorted = [...tasks];
  switch (sortBy) {
    case 'priority':
      return sorted.sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0));
    case 'due':
      return sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case 'alpha':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}

/**
 * Board — Kanban board with drag-and-drop columns and sorting.
 *
 * A11y: Each column has role="region" and aria-label.
 *
 * @param {{ tasks: Array, onEdit: function, onDelete: function, onMove: function }} props
 */
export default function Board({ tasks, onEdit, onDelete, onMove }) {
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('taskflow-sort') || 'priority'; }
    catch { return 'priority'; }
  });

  const handleSortChange = (e) => {
    const val = e.target.value;
    setSortBy(val);
    try { localStorage.setItem('taskflow-sort', val); } catch { /* noop */ }
  };

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
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    try {
      const task = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (task.status !== status) {
        onMove?.(task.id, status);
      }
    } catch (_) { /* ignore */ }
  }, [onMove]);

  // Memoize sorted tasks
  const sortedTasks = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);

  if (tasks.length === 0) {
    return (
      <div className="board-empty" role="status">
        <div className="board-empty-inner">
          <span className="board-empty-icon">📋</span>
          <h2>No tasks yet</h2>
          <p>Click <strong>+ New Task</strong> or press <kbd>N</kbd> to create your first task.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="board" role="group" aria-label="Kanban Board">
      <div className="board-toolbar">
        <label htmlFor="sort-select" className="sort-label">Sort by</label>
        <select
          id="sort-select"
          className="sort-select"
          value={sortBy}
          onChange={handleSortChange}
          aria-label="Sort tasks"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="board-columns">
        {COLUMNS.map(col => {
          const colTasks = sortedTasks.filter(t => t.status === col.id);
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
                  <p className="column-empty">Drop tasks here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="drag-announcement" />
    </div>
  );
}
