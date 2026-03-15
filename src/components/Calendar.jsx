import React, { useMemo, useState } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const PRIORITY_COLORS = {
  urgent: '#fb7185',
  high: '#fbbf24',
  medium: '#a5b4fc',
  low: '#4ade80'
};

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/**
 * Calendar — Monthly calendar view showing tasks by due date.
 */
export default function Calendar({ tasks, onEdit, onNew }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = [];

    // Padding days from previous month
    const prevMonth = new Date(year, month, 0);
    for (let i = startPad - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonth.getDate() - i), isOtherMonth: true });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: new Date(year, month, d), isOtherMonth: false });
    }

    // Pad to 42 cells (6 rows)
    while (days.length < 42) {
      const nextDate = days.length - startPad - totalDays + 1;
      days.push({ date: new Date(year, month + 1, nextDate), isOtherMonth: true });
    }

    return days;
  }, [year, month]);

  // Map tasks to dates
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      if (!task.due_date) return;
      const key = task.due_date;
      if (!map[key]) map[key] = [];
      map[key].push(task);
    });
    return map;
  }, [tasks]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const navigate = (dir) => {
    setCurrentDate(new Date(year, month + dir, 1));
    setSelectedDate(null);
  };

  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  const tasksWithoutDue = tasks.filter(t => !t.due_date);
  const overdueTasks = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < today);

  const selectedKey = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    : null;
  const selectedTasks = selectedKey ? (tasksByDate[selectedKey] || []) : [];

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="btn btn-sm btn-ghost" onClick={() => navigate(-1)}>◀</button>
          <h2 className="calendar-title">{MONTHS[month]} {year}</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => navigate(1)}>▶</button>
        </div>
        <button className="btn btn-sm btn-primary" onClick={goToday}>Today</button>
      </div>

      {overdueTasks.length > 0 && (
        <div className="calendar-overdue">
          {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
        </div>
      )}

      <div className="calendar-grid">
        {WEEKDAYS.map(day => (
          <div key={day} className="calendar-weekday">{day}</div>
        ))}

        {calendarDays.map((day, i) => {
          const dateKey = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
          const dayTasks = tasksByDate[dateKey] || [];
          const isToday = isSameDay(day.date, today);
          const isSelected = selectedDate && isSameDay(day.date, selectedDate);
          const hasOverdue = dayTasks.some(t => t.status !== 'done' && day.date < today);

          return (
            <div
              key={i}
              className={`calendar-cell ${day.isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasOverdue ? 'has-overdue' : ''}`}
              onClick={() => setSelectedDate(day.date)}
            >
              <span className="calendar-date">{day.date.getDate()}</span>
              {dayTasks.length > 0 && (
                <div className="calendar-dots">
                  {dayTasks.slice(0, 3).map(t => (
                    <span
                      key={t.id}
                      className="calendar-dot"
                      style={{ background: PRIORITY_COLORS[t.priority] || '#a5b4fc' }}
                      title={t.title}
                    />
                  ))}
                  {dayTasks.length > 3 && <span className="calendar-more">+{dayTasks.length - 3}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected date detail panel */}
      {selectedDate && (
        <div className="calendar-detail">
          <h3>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            <span className="calendar-detail-count">{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</span>
          </h3>
          {selectedTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p className="calendar-empty">No tasks due this day</p>
              {onNew && (
                <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => onNew()}>
                  + Add Task for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </button>
              )}
            </div>
          ) : (
            <div className="calendar-tasks">
              {selectedTasks.map(task => (
                <div key={task.id} className="calendar-task" onClick={() => onEdit?.(task)}>
                  <span className={`badge ${task.priority}`}>{task.priority}</span>
                  <span className="calendar-task-title">{task.title}</span>
                  <span className={`calendar-task-status status-${task.status}`}>
                    {task.status === 'done' ? '✓' : task.status === 'inprogress' ? '○' : '●'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tasksWithoutDue.length > 0 && (
        <div className="calendar-unscheduled">
          <h4>Unscheduled ({tasksWithoutDue.length})</h4>
          <div className="calendar-tasks">
            {tasksWithoutDue.slice(0, 5).map(task => (
              <div key={task.id} className="calendar-task" onClick={() => onEdit?.(task)}>
                <span className={`badge ${task.priority}`}>{task.priority}</span>
                <span className="calendar-task-title">{task.title}</span>
              </div>
            ))}
            {tasksWithoutDue.length > 5 && <p className="calendar-empty">+{tasksWithoutDue.length - 5} more</p>}
          </div>
        </div>
      )}
    </div>
  );
}
