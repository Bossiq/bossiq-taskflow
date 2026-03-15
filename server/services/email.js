/**
 * Email notification service for TaskFlow.
 *
 * Sends due-date reminders and task notifications via SMTP.
 * Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.
 * Falls back to console logging if SMTP is not configured.
 *
 * @module server/services/email
 */

import nodemailer from 'nodemailer';

const IS_CONFIGURED = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

let transporter = null;

if (IS_CONFIGURED) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('[Email] SMTP configured:', process.env.SMTP_HOST);
} else {
  console.log('[Email] SMTP not configured — email notifications disabled');
}

const FROM = process.env.SMTP_FROM || 'TaskFlow <noreply@taskflow.app>';

/**
 * Send an email notification.
 *
 * @param {string} to — recipient email
 * @param {string} subject — email subject
 * @param {string} html — HTML body
 * @returns {Promise<boolean>} — true if sent successfully
 */
export async function sendEmail(to, subject, html) {
  if (!transporter) {
    console.log(`[Email] (dry-run) To: ${to} | Subject: ${subject}`);
    return false;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[Email] Sent to ${to}: "${subject}"`);
    return true;
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return false;
  }
}

/**
 * Generate a due-date reminder email.
 *
 * @param {string} username — recipient's display name
 * @param {Array} tasks — list of tasks due
 * @param {string} period — 'today', 'tomorrow', 'overdue'
 * @returns {{ subject: string, html: string }}
 */
export function buildReminderEmail(username, tasks, period) {
  const periodLabel = period === 'overdue' ? '⚠️ Overdue' : period === 'today' ? '📋 Due Today' : '📌 Due Tomorrow';
  const urgencyColor = period === 'overdue' ? '#ef4444' : period === 'today' ? '#f59e0b' : '#0ea5e9';

  const taskRows = tasks.map(t => `
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee;">
        <strong>${t.title}</strong>
        ${t.priority ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;font-size:0.75rem;background:${urgencyColor}15;color:${urgencyColor};font-weight:600;">${t.priority}</span>` : ''}
        ${t.due_date ? `<div style="color:#888;font-size:0.8rem;margin-top:4px;">Due: ${new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>` : ''}
      </td>
    </tr>
  `).join('');

  const subject = `TaskFlow — ${periodLabel}: ${tasks.length} task${tasks.length > 1 ? 's' : ''} need attention`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 24px;color:#fff;">
        <h1 style="margin:0;font-size:1.3rem;font-weight:700;">TaskFlow</h1>
        <p style="margin:8px 0 0;opacity:0.8;font-size:0.9rem;">Task Reminder</p>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:0.95rem;color:#334155;">
          Hi <strong>${username}</strong>, you have <span style="color:${urgencyColor};font-weight:700;">${tasks.length}</span> task${tasks.length > 1 ? 's' : ''} ${period === 'overdue' ? 'overdue' : `due ${period}`}:
        </p>

        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tbody>
            ${taskRows}
          </tbody>
        </table>

        <div style="margin-top:24px;text-align:center;">
          <a href="${process.env.ALLOWED_ORIGIN || 'https://bossiq-taskflow.vercel.app'}" style="display:inline-block;padding:10px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:0.9rem;">
            Open TaskFlow →
          </a>
        </div>
      </div>

      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;text-align:center;color:#94a3b8;font-size:0.75rem;">
        TaskFlow — Smart task management
      </div>
    </div>
  `;

  return { subject, html };
}

export const isConfigured = IS_CONFIGURED;
