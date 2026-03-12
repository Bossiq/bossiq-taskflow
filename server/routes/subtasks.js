/**
 * Subtask routes — CRUD + toggle for checklist items within tasks.
 * @module server/routes/subtasks
 */

import { Router } from 'express';
import db from '../db.js';

const router = Router({ mergeParams: true });

const MAX_TITLE_LEN = 200;

/** Helper: log an activity event */
function logActivity(taskId, action, details = '') {
  try {
    db.prepare('INSERT INTO activity_log (task_id, action, details) VALUES (?, ?, ?)').run(taskId, action, details);
  } catch { /* non-critical */ }
}

// GET subtasks for a task
router.get('/', (req, res) => {
  try {
    const subtasks = db.prepare(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY position ASC, id ASC'
    ).all(req.params.taskId);
    res.json(subtasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create subtask
router.post('/', (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Subtask title is required' });
    if (title.length > MAX_TITLE_LEN) return res.status(400).json({ error: `Title must be ${MAX_TITLE_LEN} characters or less` });

    // Get next position
    const last = db.prepare(
      'SELECT MAX(position) as maxPos FROM subtasks WHERE task_id = ?'
    ).get(req.params.taskId);
    const position = (last?.maxPos ?? -1) + 1;

    const result = db.prepare(
      'INSERT INTO subtasks (task_id, title, position) VALUES (?, ?, ?)'
    ).run(req.params.taskId, title.trim(), position);

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid);
    logActivity(req.params.taskId, 'subtask_added', `Added subtask "${subtask.title}"`);
    res.status(201).json(subtask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle subtask completion
router.patch('/:subtaskId/toggle', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.subtaskId);
    if (!existing) return res.status(404).json({ error: 'Subtask not found' });

    db.prepare('UPDATE subtasks SET completed = ? WHERE id = ?')
      .run(existing.completed ? 0 : 1, req.params.subtaskId);

    const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.subtaskId);
    if (updated.completed) {
      logActivity(req.params.taskId, 'subtask_completed', `Completed subtask "${updated.title}"`);
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update subtask title
router.put('/:subtaskId', (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Subtask title is required' });
    if (title.length > MAX_TITLE_LEN) return res.status(400).json({ error: `Title must be ${MAX_TITLE_LEN} characters or less` });

    const existing = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.subtaskId);
    if (!existing) return res.status(404).json({ error: 'Subtask not found' });

    db.prepare('UPDATE subtasks SET title = ? WHERE id = ?').run(title.trim(), req.params.subtaskId);
    const updated = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.subtaskId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE subtask
router.delete('/:subtaskId', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.subtaskId);
    if (result.changes === 0) return res.status(404).json({ error: 'Subtask not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
