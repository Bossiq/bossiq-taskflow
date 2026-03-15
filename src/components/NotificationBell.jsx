import React, { useState, useEffect, useRef, useCallback } from 'react';

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

const ACTION_ICONS = {
  created: '●', updated: '✎', moved: '→',
  completed: '✓', deleted: '×',
  subtask_added: '+', subtask_completed: '✓',
  recurring_created: '↻'
};

/**
 * NotificationBell — Top bar notification icon with dropdown panel.
 * Shows due-today, overdue tasks, and recent activity.
 */
export default function NotificationBell({ tasks, getHeaders }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [lastSeen, setLastSeen] = useState(() => {
    return localStorage.getItem('taskflow-notif-seen') || '1970-01-01';
  });
  const panelRef = useRef(null);

  // Fetch activity
  const fetchActivity = useCallback(() => {
    const headers = getHeaders?.() || {};
    fetch('/api/activity?limit=10', { headers, credentials: 'include' })
      .then(r => r.json())
      .then(data => setActivity(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [getHeaders]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Refresh when panel opens
  useEffect(() => {
    if (isOpen) fetchActivity();
  }, [isOpen, fetchActivity]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Compute notifications
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dueToday = tasks.filter(t =>
    t.due_date && t.status !== 'done' &&
    new Date(t.due_date + 'T00:00:00').getTime() === today.getTime()
  );

  const overdue = tasks.filter(t =>
    t.due_date && t.status !== 'done' &&
    new Date(t.due_date) < today
  );

  const dueTomorrow = tasks.filter(t =>
    t.due_date && t.status !== 'done' &&
    new Date(t.due_date + 'T00:00:00').getTime() === tomorrow.getTime()
  );

  // Unread count: activity items newer than lastSeen + overdue + due today
  const newActivity = activity.filter(a => a.created_at > lastSeen).length;
  const unreadCount = overdue.length + dueToday.length + newActivity;

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Mark as seen
      const now = new Date().toISOString();
      setLastSeen(now);
      localStorage.setItem('taskflow-notif-seen', now);
    }
  };

  return (
    <div className="notif-bell-wrapper" ref={panelRef}>
      <button
        className="btn-icon notif-bell-btn"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ''}`}
        title="Notifications"
      >
        <span className="notif-bell-icon">⊙</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {activity.length > 0 && (
              <button
                className="btn-ghost btn-sm notif-clear"
                onClick={() => {
                  const now = new Date().toISOString();
                  setLastSeen(now);
                  localStorage.setItem('taskflow-notif-seen', now);
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {/* Overdue section */}
            {overdue.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title notif-danger">Overdue</div>
                {overdue.slice(0, 3).map(t => (
                  <div key={t.id} className="notif-item notif-item-danger">
                    <span className="notif-item-icon">!</span>
                    <div className="notif-item-content">
                      <span className="notif-item-text">{t.title}</span>
                      <span className="notif-item-meta">
                        Due {new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
                {overdue.length > 3 && (
                  <div className="notif-more">+{overdue.length - 3} more overdue</div>
                )}
              </div>
            )}

            {/* Due today */}
            {dueToday.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title notif-warning">Due Today</div>
                {dueToday.map(t => (
                  <div key={t.id} className="notif-item notif-item-warning">
                    <span className="notif-item-icon">●</span>
                    <div className="notif-item-content">
                      <span className="notif-item-text">{t.title}</span>
                      <span className="notif-item-meta">{t.priority} priority</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Due tomorrow */}
            {dueTomorrow.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title">Due Tomorrow</div>
                {dueTomorrow.map(t => (
                  <div key={t.id} className="notif-item">
                    <span className="notif-item-icon">○</span>
                    <div className="notif-item-content">
                      <span className="notif-item-text">{t.title}</span>
                      <span className="notif-item-meta">{t.priority} priority</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent activity */}
            {activity.length > 0 && (
              <div className="notif-section">
                <div className="notif-section-title">Recent Activity</div>
                {activity.slice(0, 5).map(a => (
                  <div key={a.id} className={`notif-item ${a.created_at > lastSeen ? 'notif-item-unread' : ''}`}>
                    <span className="notif-item-icon">{ACTION_ICONS[a.action] || '●'}</span>
                    <div className="notif-item-content">
                      <span className="notif-item-text">{a.details}</span>
                      <span className="notif-item-meta">{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0 && activity.length === 0 && (
              <div className="notif-empty">
                <span className="notif-empty-icon">—</span>
                <p>No notifications</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
