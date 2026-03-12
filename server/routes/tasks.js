import { Router } from 'express';
import db from '../db.js';

const router = Router();

// --- Validation helpers ---
const VALID_STATUSES = ['todo', 'inprogress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAX_TITLE_LEN = 200;
const MAX_DESC_LEN = 2000;
const MAX_LABEL_LEN = 50;

function validateTaskInput(body, requireTitle = false) {
  const errors = [];
  if (requireTitle && (!body.title || !body.title.trim())) {
    errors.push('Title is required');
  }
  if (body.title && body.title.length > MAX_TITLE_LEN) {
    errors.push(`Title must be ${MAX_TITLE_LEN} characters or less`);
  }
  if (body.description && body.description.length > MAX_DESC_LEN) {
    errors.push(`Description must be ${MAX_DESC_LEN} characters or less`);
  }
  if (body.label && body.label.length > MAX_LABEL_LEN) {
    errors.push(`Label must be ${MAX_LABEL_LEN} characters or less`);
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    errors.push(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    errors.push(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  if (body.due_date && isNaN(Date.parse(body.due_date))) {
    errors.push('Invalid due date format');
  }
  return errors;
}

// GET task stats — MUST be before /:id to avoid matching "stats" as an id
router.get('/stats/summary', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    const byStatus = db.prepare(
      'SELECT status, COUNT(*) as count FROM tasks GROUP BY status'
    ).all();
    const byPriority = db.prepare(
      'SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority'
    ).all();
    const completedToday = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= date('now', 'start of day')
    `).get();
    const completedThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= date('now', '-7 days')
    `).get();

    res.json({
      total: total.count,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])),
      byPriority: Object.fromEntries(byPriority.map(r => [r.priority, r.count])),
      completedToday: completedToday.count,
      completedThisWeek: completedThisWeek.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent completions
router.get('/recent/completed', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const tasks = db.prepare(
      'SELECT * FROM tasks WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?'
    ).all(limit);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all tasks (optionally filter by project_id or status)
router.get('/', (req, res) => {
  try {
    const { project_id, status, search } = req.query;
    let query = 'SELECT * FROM tasks';
    const conditions = [];
    const params = [];

    if (project_id) {
      conditions.push('project_id = ?');
      params.push(project_id);
    }
    if (status && VALID_STATUSES.includes(status)) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY position ASC, created_at DESC';

    const tasks = db.prepare(query).all(...params);

    // Enrich with subtask counts
    const enriched = tasks.map(task => {
      const subtaskStats = db.prepare(
        'SELECT COUNT(*) as total, SUM(completed) as done FROM subtasks WHERE task_id = ?'
      ).get(task.id);
      return {
        ...task,
        subtask_total: subtaskStats?.total || 0,
        subtask_done: subtaskStats?.done || 0
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single task
router.get('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
router.post('/', (req, res) => {
  try {
    const errors = validateTaskInput(req.body, true);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    const { title, description, status, priority, label, due_date, project_id } = req.body;

    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE status = ?'
    ).get(status || 'todo');

    const result = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, label, due_date, project_id, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      (description || '').trim(),
      status || 'todo',
      priority || 'medium',
      (label || '').trim(),
      due_date || null,
      project_id || 1,
      maxPos.max + 1
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update task
router.put('/:id', (req, res) => {
  try {
    const errors = validateTaskInput(req.body, false);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    const { title, description, status, priority, label, due_date, project_id } = req.body;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completedAt = (status === 'done' && existing.status !== 'done')
      ? new Date().toISOString()
      : (status !== 'done' ? null : existing.completed_at);

    db.prepare(`
      UPDATE tasks SET title=?, description=?, status=?, priority=?, label=?, due_date=?, project_id=?,
        updated_at=CURRENT_TIMESTAMP, completed_at=?
      WHERE id=?
    `).run(
      (title ?? existing.title).trim(),
      (description ?? existing.description).trim(),
      status ?? existing.status,
      priority ?? existing.priority,
      (label ?? existing.label).trim(),
      due_date !== undefined ? (due_date || null) : existing.due_date,
      project_id ?? existing.project_id,
      completedAt,
      req.params.id
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH move task (change status + reorder)
router.patch('/:id/move', (req, res) => {
  try {
    const { status, position } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completedAt = (status === 'done' && existing.status !== 'done')
      ? new Date().toISOString()
      : (status !== 'done' ? null : existing.completed_at);

    db.prepare(`
      UPDATE tasks SET status=?, position=?, updated_at=CURRENT_TIMESTAMP, completed_at=?
      WHERE id=?
    `).run(status, position ?? 0, completedAt, req.params.id);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
