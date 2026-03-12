/**
 * Comment routes — CRUD for task comments.
 * @module server/routes/comments
 */
import { Router } from 'express';
import db from '../db.js';

const router = Router({ mergeParams: true });

/**
 * GET /api/tasks/:taskId/comments — List comments for a task
 */
router.get('/', (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = db.prepare(`
      SELECT c.*, u.username 
      FROM comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.task_id = ? 
      ORDER BY c.created_at ASC
    `).all(taskId);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tasks/:taskId/comments — Add a comment
 */
router.post('/', (req, res) => {
  try {
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Comment too long (max 2000 chars)' });
    }

    // Verify task exists
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const userId = req.user?.id || null;

    const result = db.prepare(
      'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)'
    ).run(taskId, userId, content.trim());

    const comment = db.prepare(`
      SELECT c.*, u.username 
      FROM comments c 
      LEFT JOIN users u ON c.user_id = u.id 
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/tasks/:taskId/comments/:id — Delete a comment
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Only let the author delete their own comment
    if (req.user && comment.user_id && comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Cannot delete another user\'s comment' });
    }

    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
