/**
 * Notification routes — email reminders for due tasks.
 *
 * GET /api/notifications/reminders — Sends email reminders for overdue/due-today tasks.
 *   Can be triggered by an external cron service (e.g., cron-job.org, Render cron).
 *   Requires SMTP to be configured; returns dry-run info otherwise.
 *
 * GET /api/notifications/status — Shows email notification configuration status.
 *
 * @module server/routes/notifications
 */

import { Router } from 'express';
import db from '../db.js';
import { sendEmail, buildReminderEmail, isConfigured } from '../services/email.js';

const router = Router();

/**
 * GET /status — Check email notification configuration
 */
router.get('/status', (req, res) => {
  res.json({
    emailConfigured: isConfigured,
    provider: process.env.SMTP_HOST || 'none'
  });
});

/**
 * GET /reminders — Send due-date email reminders.
 *
 * Finds all tasks due today or overdue, groups by user,
 * and sends one email per user per period (overdue, today).
 *
 * Designed to be called by an external cron (e.g., daily at 8am).
 */
router.get('/reminders', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Find overdue tasks (due before today, not done)
    let overdueTasks, todayTasks;

    if (typeof db.prepare === 'function') {
      const prepOverdue = db.prepare(`
        SELECT t.*, u.email, u.username FROM tasks t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.due_date < ? AND t.status != 'done' AND u.email IS NOT NULL AND u.is_guest = 0
        ORDER BY t.due_date ASC
      `);
      overdueTasks = typeof prepOverdue.all === 'function' && prepOverdue.all.constructor.name === 'AsyncFunction'
        ? await prepOverdue.all(today)
        : prepOverdue.all(today);

      const prepToday = db.prepare(`
        SELECT t.*, u.email, u.username FROM tasks t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.due_date = ? AND t.status != 'done' AND u.email IS NOT NULL AND u.is_guest = 0
        ORDER BY t.priority DESC
      `);
      todayTasks = typeof prepToday.all === 'function' && prepToday.all.constructor.name === 'AsyncFunction'
        ? await prepToday.all(today)
        : prepToday.all(today);
    }

    // Group by user email
    const groupByUser = (tasks) => {
      const groups = {};
      for (const t of tasks || []) {
        if (!t.email) continue;
        if (!groups[t.email]) groups[t.email] = { username: t.username, tasks: [] };
        groups[t.email].tasks.push(t);
      }
      return groups;
    };

    const overdueByUser = groupByUser(overdueTasks);
    const todayByUser = groupByUser(todayTasks);

    let sent = 0;
    const results = [];

    // Send overdue reminders
    for (const [email, { username, tasks }] of Object.entries(overdueByUser)) {
      const { subject, html } = buildReminderEmail(username || 'there', tasks, 'overdue');
      const ok = await sendEmail(email, subject, html);
      results.push({ email, period: 'overdue', count: tasks.length, sent: ok });
      if (ok) sent++;
    }

    // Send today reminders
    for (const [email, { username, tasks }] of Object.entries(todayByUser)) {
      const { subject, html } = buildReminderEmail(username || 'there', tasks, 'today');
      const ok = await sendEmail(email, subject, html);
      results.push({ email, period: 'today', count: tasks.length, sent: ok });
      if (ok) sent++;
    }

    res.json({
      success: true,
      emailConfigured: isConfigured,
      totalOverdue: overdueTasks?.length || 0,
      totalDueToday: todayTasks?.length || 0,
      emailsSent: sent,
      details: results
    });
  } catch (err) {
    console.error('[Notifications] Reminder error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
