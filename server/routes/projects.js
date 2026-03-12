import { Router } from 'express';
import db from '../db.js';

const router = Router();

const MAX_NAME_LEN = 100;
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// GET all projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    const withCounts = projects.map(p => {
      const counts = db.prepare(
        'SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status'
      ).all(p.id);
      const total = db.prepare(
        'SELECT COUNT(*) as count FROM tasks WHERE project_id = ?'
      ).get(p.id);
      return {
        ...p,
        taskCounts: Object.fromEntries(counts.map(r => [r.status, r.count])),
        totalTasks: total.count
      };
    });
    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (name.length > MAX_NAME_LEN) return res.status(400).json({ error: `Name must be ${MAX_NAME_LEN} characters or less` });
    if (color && !COLOR_REGEX.test(color)) return res.status(400).json({ error: 'Color must be a valid hex color (e.g. #6366f1)' });

    const result = db.prepare(
      'INSERT INTO projects (name, color) VALUES (?, ?)'
    ).run(name.trim(), color || '#6366f1');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update project
router.put('/:id', (req, res) => {
  try {
    const { name, color } = req.body;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    if (name && name.length > MAX_NAME_LEN) return res.status(400).json({ error: `Name must be ${MAX_NAME_LEN} characters or less` });
    if (color && !COLOR_REGEX.test(color)) return res.status(400).json({ error: 'Color must be a valid hex color' });

    db.prepare(
      'UPDATE projects SET name=?, color=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run((name ?? existing.name).trim(), color ?? existing.color, req.params.id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', (req, res) => {
  try {
    // Prevent deleting the last project
    const count = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    if (count.count <= 1) return res.status(400).json({ error: 'Cannot delete the last project' });

    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
    // Move orphaned tasks to first remaining project
    const firstProject = db.prepare('SELECT id FROM projects ORDER BY id ASC LIMIT 1').get();
    if (firstProject) {
      db.prepare('UPDATE tasks SET project_id = ? WHERE project_id IS NULL OR project_id = ?').run(firstProject.id, req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
