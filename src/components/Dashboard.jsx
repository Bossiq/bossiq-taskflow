import React, { useState, useEffect } from 'react';

const ACTION_ICONS = {
  created: '●',
  updated: '✎',
  moved: '→',
  completed: '✓',
  deleted: '×',
  subtask_added: '+',
  subtask_completed: '✓'
};

const ACTION_COLORS = {
  created: '#4ade80',
  updated: '#a5b4fc',
  moved: '#fbbf24',
  completed: '#22c55e',
  deleted: '#fb7185',
  subtask_added: '#06b6d4',
  subtask_completed: '#22c55e'
};

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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

export default function Dashboard({ refreshKey, getHeaders, overdueTasks: externalOverdue, onNavigate, onNewTask, onExportCSV, user }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [streak, setStreak] = useState(0);
  const [overdue, setOverdue] = useState([]);
  const headers = getHeaders?.() || {};

  useEffect(() => {
    fetch('/api/tasks/stats/summary', { headers, credentials: 'include' })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
    fetch('/api/activity?limit=15', { headers, credentials: 'include' })
      .then(r => r.json())
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/activity/streak', { headers, credentials: 'include' })
      .then(r => r.json())
      .then(data => setStreak(data?.streak || 0))
      .catch(() => {});
    // Use external overdue list if provided, else fetch
    if (externalOverdue) {
      setOverdue(externalOverdue);
    } else {
      fetch('/api/tasks', { headers, credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data)) return;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          setOverdue(data.filter(t =>
            t.due_date && t.status !== 'done' && new Date(t.due_date) < today
          ));
        })
        .catch(() => {});
    }
  }, [refreshKey, externalOverdue]);

  if (!stats) return <div className="dashboard"><p style={{ color: 'var(--text-muted)' }}>Loading stats...</p></div>;

  const total = stats.total || 0;
  const done = stats.byStatus?.done || 0;
  const todo = stats.byStatus?.todo || 0;
  const inprog = stats.byStatus?.inprogress || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Donut chart angles
  const todoPct = total > 0 ? (todo / total) * 100 : 0;
  const inprogPct = total > 0 ? (inprog / total) * 100 : 0;

  const priorityBars = [
    { label: 'Low', value: stats.byPriority?.low || 0, color: '#4ade80' },
    { label: 'Medium', value: stats.byPriority?.medium || 0, color: '#a5b4fc' },
    { label: 'High', value: stats.byPriority?.high || 0, color: '#fbbf24' },
    { label: 'Urgent', value: stats.byPriority?.urgent || 0, color: '#fb7185' }
  ];
  const maxPriority = Math.max(...priorityBars.map(b => b.value), 1);

  const greeting = getGreeting();
  const displayName = user?.username || 'Guest';

  return (
    <div className="dashboard">
      {/* Welcome Header */}
      <div className="overview-header">
        <div className="overview-greeting">
          <h2 className="overview-title">{greeting}, {displayName}</h2>
          <p className="overview-date">{formatDate()}</p>
        </div>
        <div className="overview-actions">
          <button className="btn btn-primary btn-sm" onClick={onNewTask}>
            + New Task
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('calendar')}>
            Calendar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onExportCSV}>
            Export
          </button>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="overdue-banner" role="alert">
          <span className="overdue-icon">⚠</span>
          <div>
            <strong>{overdue.length} overdue task{overdue.length > 1 ? 's' : ''}</strong>
            <div className="overdue-list">
              {overdue.slice(0, 3).map(t => (
                <span key={t.id} className="overdue-tag">
                  {t.title} <small>({new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</small>
                </span>
              ))}
              {overdue.length > 3 && <span className="overdue-tag">+{overdue.length - 3} more</span>}
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <button className="stat-card stat-card-interactive" onClick={() => onNavigate?.('board')} title="View all tasks">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Tasks</div>
          <span className="stat-arrow">→</span>
        </button>
        <button className="stat-card stat-card-interactive" onClick={() => onNavigate?.('board')} title="View board">
          <div className="stat-value">{stats.completedToday}</div>
          <div className="stat-label">Completed Today</div>
          <span className="stat-arrow">→</span>
        </button>
        <button className="stat-card stat-card-interactive" onClick={() => onNavigate?.('board')} title="View board">
          <div className="stat-value">{stats.completedThisWeek}</div>
          <div className="stat-label">This Week</div>
          <span className="stat-arrow">→</span>
        </button>
        <div className="stat-card stat-card-accent">
          <div className="stat-value">{pct}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
        {streak > 0 && (
          <div className="stat-card stat-card-streak">
            <div className="stat-value">{streak}d</div>
            <div className="stat-label">Day Streak</div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {total === 0 && (
        <div className="overview-empty">
          <span className="overview-empty-icon">—</span>
          <h3>No tasks yet</h3>
          <p>Create your first task to see stats and analytics here.</p>
          <button className="btn btn-primary" onClick={onNewTask}>
            + Create First Task
          </button>
        </div>
      )}

      {/* Donut chart + Priority bars side by side */}
      {total > 0 && (
        <div className="dashboard-charts">
          <div className="chart-section">
            <h3>Task Distribution</h3>
            <div className="donut-container">
              <div
                className="donut-chart"
                style={{
                  background: total > 0
                    ? `conic-gradient(var(--accent) 0% ${todoPct}%, var(--warning) ${todoPct}% ${todoPct + inprogPct}%, var(--success) ${todoPct + inprogPct}% 100%)`
                    : 'var(--bg-secondary)'
                }}
              >
                <div className="donut-hole">
                  <span className="donut-pct">{pct}%</span>
                  <span className="donut-label">done</span>
                </div>
              </div>
              <div className="donut-legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--accent)' }} /> To Do ({todo})</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--warning)' }} /> In Progress ({inprog})</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: 'var(--success)' }} /> Done ({done})</div>
              </div>
            </div>
          </div>

          <div className="chart-section">
            <h3>By Priority</h3>
            <div className="bar-chart">
              {priorityBars.map(bar => (
                <div className="bar-row" key={bar.label}>
                  <span className="bar-label">{bar.label}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${(bar.value / maxPriority) * 100}%`,
                      background: bar.color, minWidth: bar.value > 0 ? '30px' : '0'
                    }}>{bar.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div className="chart-section">
          <h3>Recent Activity</h3>
          <div className="activity-feed">
            {activity.map(item => (
              <div key={item.id} className="activity-item" style={{ '--activity-color': ACTION_COLORS[item.action] || '#666' }}>
                <span className="activity-icon">{ACTION_ICONS[item.action] || '●'}</span>
                <div className="activity-content">
                  <span className="activity-text">{item.details}</span>
                  <span className="activity-time">{timeAgo(item.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="shortcuts-help">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
          Press <kbd>?</kbd> anywhere to see all keyboard shortcuts
        </p>
      </div>
    </div>
  );
}
