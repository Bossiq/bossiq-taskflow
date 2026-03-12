import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
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

/** Filter chip definitions */
const PRIORITY_FILTERS = [
  { value: 'urgent', label: 'Urgent', color: '#fb7185' },
  { value: 'high', label: 'High', color: '#fbbf24' },
  { value: 'medium', label: 'Medium', color: '#a5b4fc' },
  { value: 'low', label: 'Low', color: '#4ade80' }
];

/**
 * Sorts tasks based on the selected sort option.
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
 * Board — Kanban board with drag-and-drop, filtering, sorting, and batch actions.
 */
export default function Board({ tasks, onEdit, onDelete, onMove, onBatchAction, addToast, getHeaders }) {
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('taskflow-sort') || 'priority'; }
    catch { return 'priority'; }
  });
  const [priorityFilters, setPriorityFilters] = useState([]);
  const [labelFilter, setLabelFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const handleSortChange = (e) => {
    const val = e.target.value;
    setSortBy(val);
    try { localStorage.setItem('taskflow-sort', val); } catch { /* noop */ }
  };

  // Filter logic
  const togglePriorityFilter = (priority) => {
    setPriorityFilters(prev =>
      prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
    );
  };

  const clearFilters = () => {
    setPriorityFilters([]);
    setLabelFilter('');
  };

  // Selection logic
  const toggleSelect = useCallback((taskId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const handleBatch = async (action, value) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch('/api/tasks/batch', {
        method: 'PATCH',
        headers: getHeaders?.() || { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action, value })
      });
      if (res.ok) {
        const data = await res.json();
        addToast?.(`${action === 'delete' ? 'Deleted' : 'Updated'} ${data.affected} task${data.affected > 1 ? 's' : ''}`);
        onBatchAction?.();
        clearSelection();
      }
    } catch {
      addToast?.('Batch action failed', 'error');
    }
  };

  // Get unique labels for filter dropdown
  const allLabels = useMemo(() => {
    const labels = new Set(tasks.map(t => t.label).filter(Boolean));
    return [...labels].sort();
  }, [tasks]);

  const activeFilterCount = priorityFilters.length + (labelFilter ? 1 : 0);

  const onDragEnd = useCallback((result) => {
    const { source, destination, draggableId } = result;
    
    // Dropped outside a valid droppable area
    if (!destination) return;

    // Dropped in the same place
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const taskId = parseInt(draggableId, 10);
    
    // Changing columns
    if (source.droppableId !== destination.droppableId) {
      onMove?.(taskId, destination.droppableId);
    } 
    // Same column - reordering
    else {
      fetch(`/api/tasks/${taskId}/reorder`, {
        method: 'PATCH',
        headers: getHeaders?.() || { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: destination.index })
      }).then(() => onBatchAction?.()).catch(() => {});
    }
  }, [onMove, getHeaders, onBatchAction]);

  // Apply filters then sort
  const filteredAndSorted = useMemo(() => {
    let filtered = tasks;
    if (priorityFilters.length > 0) {
      filtered = filtered.filter(t => priorityFilters.includes(t.priority));
    }
    if (labelFilter) {
      filtered = filtered.filter(t => t.label === labelFilter);
    }
    return sortTasks(filtered, sortBy);
  }, [tasks, sortBy, priorityFilters, labelFilter]);

  if (tasks.length === 0) {
    return (
      <div className="board-empty" role="status">
        <div className="board-empty-inner">
          <div className="board-empty-illustration">
            <div className="empty-card" style={{ animationDelay: '0ms' }}></div>
            <div className="empty-card" style={{ animationDelay: '150ms' }}></div>
            <div className="empty-card" style={{ animationDelay: '300ms' }}></div>
          </div>
          <h2>Your board is clear</h2>
          <p>Create your first task to start organizing your projects. Productivity awaits.</p>
          <div className="board-empty-actions">
            <button className="btn btn-primary btn-lg" onClick={() => document.getElementById('new-task-btn')?.click()}>
              + Create New Task
            </button>
            <span className="kb-hint">Press <kbd>N</kbd> anywhere</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="board" role="group" aria-label="Kanban Board">
        <div className="board-toolbar">
          {/* Sort */}
          <div className="toolbar-group">
            <label htmlFor="sort-select" className="sort-label">Sort by</label>
          <select id="sort-select" className="sort-select" value={sortBy} onChange={handleSortChange} aria-label="Sort tasks">
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Filter chips */}
        <div className="toolbar-group filter-chips">
          {PRIORITY_FILTERS.map(f => (
            <button
              key={f.value}
              className={`filter-chip ${priorityFilters.includes(f.value) ? 'active' : ''}`}
              style={{ '--chip-color': f.color }}
              onClick={() => togglePriorityFilter(f.value)}
              aria-pressed={priorityFilters.includes(f.value)}
            >
              {f.label}
            </button>
          ))}
          {allLabels.length > 0 && (
            <select
              className="sort-select label-filter"
              value={labelFilter}
              onChange={e => setLabelFilter(e.target.value)}
              aria-label="Filter by label"
            >
              <option value="">🏷️ All Labels</option>
              {allLabels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {activeFilterCount > 0 && (
            <button className="filter-clear" onClick={clearFilters}>
              ✕ {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Batch toggle */}
        <button
          className={`btn btn-sm ${batchMode ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => { setBatchMode(!batchMode); if (batchMode) clearSelection(); }}
          aria-pressed={batchMode}
        >
          {batchMode ? `✓ ${selectedIds.size} selected` : '☑ Select'}
        </button>
      </div>

      {/* Batch action bar */}
      {batchMode && selectedIds.size > 0 && (
        <div className="batch-bar">
          <span className="batch-label">{selectedIds.size} task{selectedIds.size > 1 ? 's' : ''} selected</span>
          <div className="batch-actions">
            <button className="btn btn-sm btn-ghost" onClick={() => handleBatch('move', 'todo')}>→ To Do</button>
            <button className="btn btn-sm btn-ghost" onClick={() => handleBatch('move', 'inprogress')}>→ In Progress</button>
            <button className="btn btn-sm btn-ghost" onClick={() => handleBatch('move', 'done')}>→ Done</button>
            <button className="btn btn-sm" style={{ color: '#fb7185' }} onClick={() => handleBatch('delete')}>🗑 Delete All</button>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={clearSelection}>Cancel</button>
        </div>
      )}

      <div className="board-columns">
        {COLUMNS.map(col => {
          const colTasks = filteredAndSorted.filter(t => t.status === col.id);
          return (
            <div className="column" key={col.id} role="region" aria-label={`${col.title} column — ${colTasks.length} tasks`}>
              <div className="column-header">
                <div className="column-title">
                  <span className={`column-dot ${col.dot}`} aria-hidden="true" />
                  {col.title}
                  <span className="column-count" aria-label={`${colTasks.length} tasks`}>{colTasks.length}</span>
                </div>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    className={`column-cards ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                {colTasks.map((task, idx) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={idx}
                  />
                ))}
                {provided.placeholder}
                {colTasks.length === 0 && (
                  <p className="column-empty">Drop tasks here</p>
                )}
              </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="drag-announcement" />
    </div>
    </DragDropContext>
  );
}
