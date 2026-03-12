import React, { useState, useEffect } from 'react';

const ACTION_ICONS = {
  created: '🟢',
  updated: '📝',
  moved: '➡️',
  completed: '✅',
  deleted: '🗑️',
  subtask_added: '➕',
  subtask_completed: '☑️'
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

export default function Dashboard({ refreshKey, getHeaders }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [streak, setStreak] = useState(0);
  const [overdue, setOverdue] = useState([]);
  const headers = getHeaders?.() || {};

  useEffect(() => {
    fetch('/api/tasks/stats/summary', { headers })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
    fetch('/api/activity?limit=15', { headers })
      .then(r => r.json())
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch('/api/activity/streak', { headers })
      .then(r => r.json())
      .then(data => setStreak(data?.streak || 0))
      .catch(() => {});
    fetch('/api/tasks', { headers })
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
  }, [refreshKey]);

  if (!stats) return <div className="dashboard"><p style={{ color: 'var(--text-muted)' }}>Loading stats...</p></div>;

  const total = stats.total || 0;
  const done = stats.byStatus?.done || 0;
  const todo = stats.byStatus?.todo || 0;
  const inprog = stats.byStatus?.inprogress || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Donut chart angles
  const todoPct = total > 0 ? (todo / total) * 100 : 0;
  const inprogPct = total > 0 ? (inprog / total) * 100 : 0;
  const donePct = total > 0 ? (done / total) * 100 : 0;

  const priorityBars = [
    { label: 'Low', value: stats.byPriority?.low || 0, color: '#4ade80' },
    { label: 'Medium', value: stats.byPriority?.medium || 0, color: '#a5b4fc' },
    { label: 'High', value: stats.byPriority?.high || 0, color: '#fbbf24' },
    { label: 'Urgent', value: stats.byPriority?.urgent || 0, color: '#fb7185' }
  ];
  const maxPriority = Math.max(...priorityBars.map(b => b.value), 1);

  return (
    <div className="dashboard">
      {overdue.length > 0 && (
        <div className="overdue-banner" role="alert">
          <span className="overdue-icon">🔥</span>
          <div>
            <strong>{overdue.length} overdue task{overdue.length > 1 ? 's' : ''}</strong>
            <div className="overdue-list">
              {overdue.slice(0, 3).map(t => (
                <span key={t.id} className="overdue-tag">
                  {t.title} <small>({new Date(t.due_date + 'T00:00:00').toLocaleDateString()})</small>
                </span>
              ))}
              {overdue.length > 3 && <span className="overdue-tag">+{overdue.length - 3} more</span>}
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completedToday}</div>
          <div className="stat-label">Completed Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completedThisWeek}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div className="stat-value">{pct}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
        {streak > 0 && (
          <div className="stat-card stat-card-streak">
            <div className="stat-value">🔥 {streak}</div>
            <div className="stat-label">Day Streak</div>
          </div>
        )}
      </div>

      {/* Donut chart + Priority bars side by side */}
      <div className="dashboard-charts">
        <div className="chart-section">
          <h3>Task Distribution</h3>
          <div className="donut-container">
            <div
              className="donut-chart"
              style={{
                background: total > 0
                  ? `conic-gradient(var(--accent) 0% ${todoPct}%, var(--warning) ${todoPct}% ${todoPct + inprogPct}%, var(--success) ${todoPct + inprogPct}% 100%)`
                  : 'var(--card-bg)'
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

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div className="chart-section">
          <h3>📋 Activity Feed</h3>
          <div className="activity-feed">
            {activity.map(item => (
              <div key={item.id} className="activity-item" style={{ '--activity-color': ACTION_COLORS[item.action] || '#666' }}>
                <span className="activity-icon">{ACTION_ICONS[item.action] || '📌'}</span>
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
        <h3>⌨️ Keyboard Shortcuts</h3>
        <div className="shortcut-grid">
          <kbd>N</kbd> <span>New task</span>
          <kbd>/</kbd> <span>Focus search</span>
          <kbd>D</kbd> <span>Toggle dashboard</span>
          <kbd>Esc</kbd> <span>Close modal</span>
        </div>
      </div>
    </div>
  );
}
