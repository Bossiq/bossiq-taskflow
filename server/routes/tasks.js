import { Router } from 'express';
import db from '../db.js';

const router = Router();

/** Helper: log an activity event */
function logActivity(taskId, action, details = '', userId = null) {
  try {
    db.prepare('INSERT INTO activity_log (task_id, action, details, user_id) VALUES (?, ?, ?, ?)').run(taskId, action, details, userId);
  } catch { /* non-critical */ }
}

/** Helper: broadcast task change via Socket.IO */
function broadcast(req, action, data) {
  try {
    const io = req.app.get('io');
    if (io) io.emit('task:change', { action, data, timestamp: Date.now() });
  } catch { /* non-critical */ }
}

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
    const userFilter = req.user ? ' WHERE user_id = ?' : '';
    const userFilterAnd = req.user ? ' AND user_id = ?' : '';
    const userParams = req.user ? [req.user.id] : [];

    const total = db.prepare(`SELECT COUNT(*) as count FROM tasks${userFilter}`).get(...userParams);
    const byStatus = db.prepare(
      `SELECT status, COUNT(*) as count FROM tasks${userFilter} GROUP BY status`
    ).all(...userParams);
    const byPriority = db.prepare(
      `SELECT priority, COUNT(*) as count FROM tasks${userFilter} GROUP BY priority`
    ).all(...userParams);
    const completedToday = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= date('now', 'start of day')${userFilterAnd}
    `).get(...userParams);
    const completedThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= date('now', '-7 days')${userFilterAnd}
    `).get(...userParams);

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
    if (req.user) {
      conditions.push('user_id = ?');
      params.push(req.user.id);
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

    const { title, description, status, priority, label, due_date, project_id, recurrence_rule } = req.body;

    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE status = ?'
    ).get(status || 'todo');

    const userId = req.user?.id || null;

    const result = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, label, due_date, project_id, position, user_id, recurrence_rule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      (description || '').trim(),
      status || 'todo',
      priority || 'medium',
      (label || '').trim(),
      due_date || null,
      project_id || 1,
      maxPos.max + 1,
      userId,
      recurrence_rule || null
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    logActivity(task.id, 'created', `Created task "${task.title}"`, userId);
    broadcast(req, 'created', task);
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

    const { title, description, status, priority, label, due_date, project_id, recurrence_rule } = req.body;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completedAt = (status === 'done' && existing.status !== 'done')
      ? new Date().toISOString()
      : (status !== 'done' ? null : existing.completed_at);

    db.prepare(`
      UPDATE tasks SET title=?, description=?, status=?, priority=?, label=?, due_date=?, project_id=?,
        updated_at=CURRENT_TIMESTAMP, completed_at=?, recurrence_rule=?
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
      recurrence_rule !== undefined ? (recurrence_rule || null) : existing.recurrence_rule,
      req.params.id
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    logActivity(task.id, 'updated', `Updated task "${task.title}"`);
    broadcast(req, 'updated', task);
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
    const action = task.status === 'done' && existing.status !== 'done' ? 'completed' : 'moved';
    logActivity(task.id, action, `${action === 'completed' ? 'Completed' : 'Moved'} task "${task.title}" to ${status}`);
    broadcast(req, 'moved', task);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /process-recurring — Auto-create new instances of completed recurring tasks
 * Called on app load. Creates a new 'todo' copy with the next due date.
 */
router.post('/process-recurring', (req, res) => {
  try {
    const userFilter = req.user ? ' AND t.user_id = ?' : '';
    const userParams = req.user ? [req.user.id] : [];

    // Find completed recurring tasks that don't already have a child
    const recurring = db.prepare(`
      SELECT t.* FROM tasks t
      WHERE t.status = 'done'
        AND t.recurrence_rule IS NOT NULL
        AND t.recurrence_rule != ''
        AND NOT EXISTS (
          SELECT 1 FROM tasks child WHERE child.recurrence_parent_id = t.id
        )
        ${userFilter}
    `).all(...userParams);

    let created = 0;
    const processAll = db.transaction(() => {
      for (const task of recurring) {
        // Calculate next due date
        let nextDue = null;
        if (task.due_date) {
          const d = new Date(task.due_date);
          if (task.recurrence_rule === 'daily') d.setDate(d.getDate() + 1);
          else if (task.recurrence_rule === 'weekly') d.setDate(d.getDate() + 7);
          else if (task.recurrence_rule === 'monthly') d.setMonth(d.getMonth() + 1);
          nextDue = d.toISOString().split('T')[0];
        }

        const maxPos = db.prepare(
          "SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE status = 'todo'"
        ).get();

        db.prepare(`
          INSERT INTO tasks (title, description, status, priority, label, due_date, project_id, position, user_id, recurrence_rule, recurrence_parent_id)
          VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.title,
          task.description || '',
          task.priority || 'medium',
          task.label || '',
          nextDue,
          task.project_id,
          maxPos.max + 1,
          task.user_id,
          task.recurrence_rule,
          task.id
        );
        logActivity(null, 'recurring_created', `Recurring ${task.recurrence_rule}: "${task.title}" auto-created (next due: ${nextDue || 'no date'})`, task.user_id);
        created++;
      }
    });

    processAll();
    res.json({ processed: recurring.length, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH batch operations
router.patch('/batch', (req, res) => {
  try {
    const { ids, action, value } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    if (ids.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 tasks per batch' });
    }
    if (!action) {
      return res.status(400).json({ error: 'action is required' });
    }

    const batchRun = db.transaction(() => {
      let affected = 0;
      for (const id of ids) {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        if (!task) continue;

        if (action === 'move' && VALID_STATUSES.includes(value)) {
          const completedAt = (value === 'done' && task.status !== 'done') ? new Date().toISOString() : (value !== 'done' ? null : task.completed_at);
          db.prepare('UPDATE tasks SET status=?, completed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(value, completedAt, id);
          logActivity(id, value === 'done' ? 'completed' : 'moved', `Batch moved "${task.title}" to ${value}`);
          affected++;
        } else if (action === 'priority' && VALID_PRIORITIES.includes(value)) {
          db.prepare('UPDATE tasks SET priority=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(value, id);
          logActivity(id, 'updated', `Batch changed "${task.title}" priority to ${value}`);
          affected++;
        } else if (action === 'delete') {
          logActivity(id, 'deleted', `Deleted task "${task.title}"`);
          db.prepare('DELETE FROM tasks WHERE id=?').run(id);
          affected++;
        }
      }
      return affected;
    });

    const affected = batchRun();
    res.json({ success: true, affected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
router.delete('/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    logActivity(req.params.id, 'deleted', `Deleted task "${task.title}"`);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    broadcast(req, 'deleted', { id: Number(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /:id/reorder — Reorder a task within its column
 */
router.patch('/:id/reorder', (req, res) => {
  try {
    const { position } = req.body;
    if (typeof position !== 'number' || position < 0) {
      return res.status(400).json({ error: 'Valid position is required' });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const reorder = db.transaction(() => {
      // Get all tasks in same column, ordered by position
      const siblings = db.prepare(
        'SELECT id, position FROM tasks WHERE status = ? AND id != ? ORDER BY position ASC'
      ).all(task.status, task.id);

      // Insert at new position
      siblings.splice(position, 0, { id: task.id, position });

      // Update all positions
      const update = db.prepare('UPDATE tasks SET position = ? WHERE id = ?');
      siblings.forEach((t, i) => update.run(i, t.id));
    });

    reorder();

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /:id/activity — Fetch the audit log timeline for a task
 */
router.get('/:id/activity', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.username as user_name 
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.task_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
