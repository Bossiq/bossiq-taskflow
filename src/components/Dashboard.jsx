import React, { useState, useEffect } from 'react';

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

export default function Dashboard({ refreshKey }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    fetch('/api/tasks/stats/summary')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
    fetch('/api/tasks/recent/completed?limit=5')
      .then(r => r.json())
      .then(data => setRecent(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [refreshKey]);

  if (!stats) return <div className="dashboard"><p style={{ color: 'var(--text-muted)' }}>Loading stats...</p></div>;

  const statusBars = [
    { label: 'To Do', value: stats.byStatus?.todo || 0, color: 'var(--accent)' },
    { label: 'In Progress', value: stats.byStatus?.inprogress || 0, color: 'var(--warning)' },
    { label: 'Done', value: stats.byStatus?.done || 0, color: 'var(--success)' }
  ];

  const priorityBars = [
    { label: 'Low', value: stats.byPriority?.low || 0, color: '#4ade80' },
    { label: 'Medium', value: stats.byPriority?.medium || 0, color: '#a5b4fc' },
    { label: 'High', value: stats.byPriority?.high || 0, color: '#fbbf24' },
    { label: 'Urgent', value: stats.byPriority?.urgent || 0, color: '#fb7185' }
  ];

  const maxStatus = Math.max(...statusBars.map(b => b.value), 1);
  const maxPriority = Math.max(...priorityBars.map(b => b.value), 1);

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
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
        <div className="stat-card">
          <div className="stat-value">
            {stats.total > 0 ? Math.round(((stats.byStatus?.done || 0) / stats.total) * 100) : 0}%
          </div>
          <div className="stat-label">Completion Rate</div>
        </div>
      </div>

      <div className="chart-section">
        <h3>By Status</h3>
        <div className="bar-chart">
          {statusBars.map(bar => (
            <div className="bar-row" key={bar.label}>
              <span className="bar-label">{bar.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{
                  width: `${(bar.value / maxStatus) * 100}%`,
                  background: bar.color, minWidth: bar.value > 0 ? '30px' : '0'
                }}>{bar.value}</div>
              </div>
            </div>
          ))}
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

      {recent.length > 0 && (
        <div className="chart-section">
          <h3>✅ Recent Completions</h3>
          <div className="recent-list">
            {recent.map(task => (
              <div key={task.id} className="recent-item">
                <span className="recent-title">{task.title}</span>
                <span className="recent-time">{timeAgo(task.completed_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
