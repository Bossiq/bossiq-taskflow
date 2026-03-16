/**
 * Shared utility for relative time formatting.
 * Replaces 4 duplicate implementations across TaskCard, TaskModal, Dashboard, NotificationBell.
 *
 * @param {string} dateStr — ISO date string
 * @returns {string} Relative time string (e.g., "2h ago", "3d ago")
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
