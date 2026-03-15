import React, { useMemo, useState } from 'react';
import { GanttChart as GanttIcon, Minus, Plus, RotateCw } from 'lucide-react';

const PRIORITY_COLORS = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: 'var(--accent)',
  low: '#64748b'
};

const STATUS_LABELS = {
  todo: 'To Do',
  inprogress: 'In Progress',
  done: 'Done'
};

/**
 * Gantt — Timeline view showing tasks as horizontal bars.
 * X-axis = dates, Y-axis = tasks grouped by status.
 * Bar length = created_at → due_date (or today if no due date).
 */
export default function Gantt({ tasks, onEdit }) {
  const [zoom, setZoom] = useState(40); // pixels per day

  // Calculate timeline range
  const { timelineStart, timelineEnd, dayCount, groups } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const tasksWithDates = tasks.map(t => {
      const created = new Date(t.created_at || now);
      created.setHours(0, 0, 0, 0);
      
      let due;
      if (t.due_date) {
        due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
      } else {
        // No due date — show bar extending 3 days from creation
        due = new Date(created);
        due.setDate(due.getDate() + 3);
      }

      // Ensure due is after created
      if (due <= created) {
        due = new Date(created);
        due.setDate(due.getDate() + 1);
      }

      return { ...t, _start: created, _end: due };
    });

    if (tasksWithDates.length === 0) {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      const end = new Date(now);
      end.setDate(end.getDate() + 14);
      return { timelineStart: start, timelineEnd: end, dayCount: 21, groups: {} };
    }

    // Find min/max dates with padding
    let minDate = new Date(Math.min(...tasksWithDates.map(t => t._start.getTime())));
    let maxDate = new Date(Math.max(...tasksWithDates.map(t => t._end.getTime())));

    // Add padding (3 days each side)
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 7);

    const days = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));

    // Group by status
    const grouped = {};
    for (const status of ['todo', 'inprogress', 'done']) {
      grouped[status] = tasksWithDates.filter(t => t.status === status);
    }

    return { timelineStart: minDate, timelineEnd: maxDate, dayCount: days, groups: grouped };
  }, [tasks]);

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const headers = [];
    const current = new Date(timelineStart);
    for (let i = 0; i < dayCount; i++) {
      const isToday = current.toDateString() === new Date().toDateString();
      const isMonday = current.getDay() === 1;
      headers.push({
        date: new Date(current),
        day: current.getDate(),
        month: current.toLocaleDateString('en-US', { month: 'short' }),
        weekday: current.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday,
        isMonday,
        isFirstOfMonth: current.getDate() === 1
      });
      current.setDate(current.getDate() + 1);
    }
    return headers;
  }, [timelineStart, dayCount]);

  // Calculate bar position for a task
  const getBarStyle = (task) => {
    const startOffset = (task._start - timelineStart) / (1000 * 60 * 60 * 24);
    const duration = (task._end - task._start) / (1000 * 60 * 60 * 24);
    return {
      left: startOffset * zoom,
      width: Math.max(duration * zoom, zoom * 0.5), // Minimum half-day width
    };
  };

  // Today marker position
  const todayOffset = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return ((now - timelineStart) / (1000 * 60 * 60 * 24)) * zoom;
  }, [timelineStart, zoom]);

  const totalWidth = dayCount * zoom;

  if (tasks.length === 0) {
    return (
      <div className="gantt-empty">
        <div className="gantt-empty-icon"><GanttIcon size={40} /></div>
        <h3>No tasks to display</h3>
        <p>Create tasks with due dates to see them on the timeline.</p>
      </div>
    );
  }

  return (
    <div className="gantt-view">
      {/* Zoom controls */}
      <div className="gantt-controls">
        <span className="gantt-zoom-label">Zoom</span>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setZoom(z => Math.max(20, z - 10))}
          disabled={zoom <= 20}
        >
          <Minus size={16} />
        </button>
        <span className="gantt-zoom-value">{zoom}px/day</span>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setZoom(z => Math.min(80, z + 10))}
          disabled={zoom >= 80}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="gantt-container">
        {/* Left labels */}
        <div className="gantt-labels">
          <div className="gantt-label-header">Task</div>
          {['todo', 'inprogress', 'done'].map(status => (
            groups[status]?.length > 0 && (
              <React.Fragment key={status}>
                <div className="gantt-group-header">{STATUS_LABELS[status]}</div>
                {groups[status].map(task => (
                  <div
                    key={task.id}
                    className="gantt-label-row"
                    onClick={() => onEdit(task)}
                    title={task.title}
                  >
                    <span
                      className="gantt-priority-dot"
                      style={{ background: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium }}
                    />
                    <span className="gantt-label-text">{task.title}</span>
                    {task.recurrence_rule && (
                      <span className="gantt-recurrence-badge" title={`Repeats ${task.recurrence_rule}`}><RotateCw size={12} /></span>
                    )}
                  </div>
                ))}
              </React.Fragment>
            )
          ))}
        </div>

        {/* Timeline area */}
        <div className="gantt-timeline-scroll">
          <div className="gantt-timeline" style={{ width: totalWidth }}>
            {/* Date headers */}
            <div className="gantt-date-headers">
              {dateHeaders.map((h, i) => (
                <div
                  key={i}
                  className={`gantt-date-cell ${h.isToday ? 'today' : ''} ${h.isMonday ? 'monday' : ''}`}
                  style={{ width: zoom, left: i * zoom }}
                >
                  {(h.isFirstOfMonth || i === 0) && (
                    <span className="gantt-month">{h.month}</span>
                  )}
                  <span className="gantt-day">{h.day}</span>
                  <span className="gantt-weekday">{h.weekday[0]}</span>
                </div>
              ))}
            </div>

            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div className="gantt-today-line" style={{ left: todayOffset + zoom / 2 }} />
            )}

            {/* Bars */}
            {['todo', 'inprogress', 'done'].map(status => (
              groups[status]?.length > 0 && (
                <React.Fragment key={status}>
                  <div className="gantt-group-spacer" />
                  {groups[status].map(task => {
                    const bar = getBarStyle(task);
                    const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} className="gantt-bar-row">
                        <div
                          className={`gantt-bar ${task.status} ${isOverdue ? 'overdue' : ''}`}
                          style={{
                            left: bar.left,
                            width: bar.width,
                            borderLeft: `3px solid ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`
                          }}
                          onClick={() => onEdit(task)}
                          title={`${task.title}\n${task.due_date ? `Due: ${task.due_date}` : 'No due date'}\nPriority: ${task.priority}`}
                        >
                          <span className="gantt-bar-text">{task.title}</span>
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
