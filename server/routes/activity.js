import { Router } from 'express';
import db from '../db.js';

const router = Router();

/**
 * GET /api/activity — Recent activity across all tasks
 * Query: ?limit=20 (max 50)
 */
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const userId = req.user?.id;
    const query = userId
      ? `SELECT a.*, t.title as task_title FROM activity_log a LEFT JOIN tasks t ON a.task_id = t.id WHERE a.user_id = ? OR a.user_id IS NULL ORDER BY a.created_at DESC LIMIT ?`
      : `SELECT a.*, t.title as task_title FROM activity_log a LEFT JOIN tasks t ON a.task_id = t.id ORDER BY a.created_at DESC LIMIT ?`;
    const rows = userId ? db.prepare(query).all(userId, limit) : db.prepare(query).all(limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/activity/streak — Productivity streak (consecutive days with completions)
 */
router.get('/streak', (req, res) => {
  try {
    const userId = req.user?.id;
    const query = userId
      ? `SELECT DISTINCT date(created_at) as day FROM activity_log WHERE action = 'completed' AND (user_id = ? OR user_id IS NULL) ORDER BY day DESC LIMIT 365`
      : `SELECT DISTINCT date(created_at) as day FROM activity_log WHERE action = 'completed' ORDER BY day DESC LIMIT 365`;
    const days = userId ? db.prepare(query).all(userId) : db.prepare(query).all();

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < days.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().slice(0, 10);
      if (days[i].day === expectedStr) {
        streak++;
      } else {
        break;
      }
    }

    res.json({ streak });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
