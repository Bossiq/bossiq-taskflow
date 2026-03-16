import { Router } from 'express';
import db from '../db.js';

const router = Router();

/** Helper: log an activity event */
async function logActivity(taskId, action, details = '', userId = null) {
  try {
    await db.prepare('INSERT INTO activity_log (task_id, action, details, user_id) VALUES (?, ?, ?, ?)').run(taskId, action, details, userId);
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
router.get('/stats/summary', async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ total: 0, byStatus: {}, byPriority: {}, completedToday: 0, completedThisWeek: 0 });
    }
    const userFilter = ' WHERE user_id = ?';
    const userFilterAnd = ' AND user_id = ?';
    const userParams = [req.user.id];

    const total = await db.prepare(`SELECT COUNT(*) as count FROM tasks${userFilter}`).get(...userParams);
    const byStatus = await db.prepare(
      `SELECT status, COUNT(*) as count FROM tasks${userFilter} GROUP BY status`
    ).all(...userParams);
    const byPriority = await db.prepare(
      `SELECT priority, COUNT(*) as count FROM tasks${userFilter} GROUP BY priority`
    ).all(...userParams);
    const completedToday = await db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= date('now', 'start of day')${userFilterAnd}
    `).get(...userParams);
    const completedThisWeek = await db.prepare(`
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
router.get('/recent/completed', async (req, res) => {
  try {
    if (!req.user) return res.json([]);
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const tasks = await db.prepare(
      'SELECT * FROM tasks WHERE completed_at IS NOT NULL AND user_id = ? ORDER BY completed_at DESC LIMIT ?'
    ).all(req.user.id, limit);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all tasks (optionally filter by project_id or status)
router.get('/', async (req, res) => {
  try {
    // Unauthenticated users must not see orphaned data
    if (!req.user) {
      return res.json([]);
    }

    const { project_id, status, search } = req.query;
    let query = `
      SELECT t.*,
        COALESCE(s.total, 0) as subtask_total,
        COALESCE(s.done, 0) as subtask_done
      FROM tasks t
      LEFT JOIN (
        SELECT task_id, COUNT(*) as total, SUM(completed) as done
        FROM subtasks GROUP BY task_id
      ) s ON s.task_id = t.id
    `;
    const conditions = ['t.user_id = ?'];
    const params = [req.user.id];

    if (project_id) {
      conditions.push('t.project_id = ?');
      params.push(project_id);
    }
    if (status && VALID_STATUSES.includes(status)) {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.position ASC, t.created_at DESC';

    const tasks = await db.prepare(query).all(...params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single task
router.get('/:id', async (req, res) => {
  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create task
router.post('/', async (req, res) => {
  try {
    const errors = validateTaskInput(req.body, true);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    const { title, description, status, priority, label, due_date, project_id, recurrence_rule } = req.body;

    const maxPos = await db.prepare(
      'SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE status = ?'
    ).get(status || 'todo');

    const userId = req.user?.id || null;

    // Resolve project: use provided, or find user's first project, or null
    let resolvedProjectId = project_id || null;
    if (!resolvedProjectId && userId) {
      const userProject = await db.prepare(
        'SELECT id FROM projects WHERE user_id = ? ORDER BY id ASC LIMIT 1'
      ).get(userId);
      resolvedProjectId = userProject?.id || null;
    }

    const result = await db.prepare(`
      INSERT INTO tasks (title, description, status, priority, label, due_date, project_id, position, user_id, recurrence_rule)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      (description || '').trim(),
      status || 'todo',
      priority || 'medium',
      (label || '').trim(),
      due_date || null,
      resolvedProjectId,
      maxPos.max + 1,
      userId,
      recurrence_rule || null
    );

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    await logActivity(task.id, 'created', `Created task "${task.title}"`, userId);
    broadcast(req, 'created', task);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update task
router.put('/:id', async (req, res) => {
  try {
    const errors = validateTaskInput(req.body, false);
    if (errors.length > 0) return res.status(400).json({ error: errors.join('; ') });

    const { title, description, status, priority, label, due_date, project_id, recurrence_rule } = req.body;
    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completedAt = (status === 'done' && existing.status !== 'done')
      ? new Date().toISOString()
      : (status !== 'done' ? null : existing.completed_at);

    await db.prepare(`
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

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    await logActivity(task.id, 'updated', `Updated task "${task.title}"`);
    broadcast(req, 'updated', task);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH move task (change status + reorder)
router.patch('/:id/move', async (req, res) => {
  try {
    const { status, position } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completedAt = (status === 'done' && existing.status !== 'done')
      ? new Date().toISOString()
      : (status !== 'done' ? null : existing.completed_at);

    await db.prepare(`
      UPDATE tasks SET status=?, position=?, updated_at=CURRENT_TIMESTAMP, completed_at=?
      WHERE id=?
    `).run(status, position ?? 0, completedAt, req.params.id);

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    const action = task.status === 'done' && existing.status !== 'done' ? 'completed' : 'moved';
    await logActivity(task.id, action, `${action === 'completed' ? 'Completed' : 'Moved'} task "${task.title}" to ${status}`);
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
router.post('/process-recurring', async (req, res) => {
  try {
    const userFilter = req.user ? ' AND t.user_id = ?' : '';
    const userParams = req.user ? [req.user.id] : [];

    // Find completed recurring tasks that don't already have a child
    const recurring = await db.prepare(`
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

      const maxPos = await db.prepare(
        "SELECT COALESCE(MAX(position), -1) as max FROM tasks WHERE status = 'todo'"
      ).get();

      await db.prepare(`
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
      await logActivity(null, 'recurring_created', `Recurring ${task.recurrence_rule}: "${task.title}" auto-created (next due: ${nextDue || 'no date'})`, task.user_id);
      created++;
    }

    res.json({ processed: recurring.length, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH batch operations
router.patch('/batch', async (req, res) => {
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

    let affected = 0;
    for (const id of ids) {
      const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) continue;

      if (action === 'move' && VALID_STATUSES.includes(value)) {
        const completedAt = (value === 'done' && task.status !== 'done') ? new Date().toISOString() : (value !== 'done' ? null : task.completed_at);
        await db.prepare('UPDATE tasks SET status=?, completed_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(value, completedAt, id);
        await logActivity(id, value === 'done' ? 'completed' : 'moved', `Batch moved "${task.title}" to ${value}`);
        affected++;
      } else if (action === 'priority' && VALID_PRIORITIES.includes(value)) {
        await db.prepare('UPDATE tasks SET priority=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(value, id);
        await logActivity(id, 'updated', `Batch changed "${task.title}" priority to ${value}`);
        affected++;
      } else if (action === 'delete') {
        await logActivity(id, 'deleted', `Deleted task "${task.title}"`);
        await db.prepare('DELETE FROM tasks WHERE id=?').run(id);
        affected++;
      }
    }

    res.json({ success: true, affected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE task
router.delete('/:id', async (req, res) => {
  try {
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await logActivity(req.params.id, 'deleted', `Deleted task "${task.title}"`);
    await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    broadcast(req, 'deleted', { id: Number(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /:id/reorder — Reorder a task within its column
 */
router.patch('/:id/reorder', async (req, res) => {
  try {
    const { position } = req.body;
    if (typeof position !== 'number' || position < 0) {
      return res.status(400).json({ error: 'Valid position is required' });
    }

    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Get all tasks in same column, ordered by position
    const siblings = await db.prepare(
      'SELECT id, position FROM tasks WHERE status = ? AND id != ? ORDER BY position ASC'
    ).all(task.status, task.id);

    // Insert at new position
    siblings.splice(position, 0, { id: task.id, position });

    // Update all positions
    for (let i = 0; i < siblings.length; i++) {
      await db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(i, siblings[i].id);
    }

    const updated = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /:id/activity — Fetch the audit log timeline for a task
 */
router.get('/:id/activity', async (req, res) => {
  try {
    const logs = await db.prepare(`
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
