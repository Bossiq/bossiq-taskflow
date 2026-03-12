import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';

describe('API', () => {

  // ── Health ──
  describe('GET /api/health', () => {
    it('returns status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
    });

    it('returns X-Request-Id header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBe(8);
    });
  });

  // ── 404 ──
  describe('Unknown routes', () => {
    it('returns 404 for unknown API routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Not found');
    });
  });

  // ── Projects ──
  describe('Projects API', () => {
    it('GET /api/projects returns array', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/projects creates a project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Test Project', color: '#06b6d4' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Project');
      expect(res.body.color).toBe('#06b6d4');
      expect(res.body).toHaveProperty('id');
    });

    it('POST /api/projects rejects empty name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: '', color: '#6366f1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('POST /api/projects rejects invalid color', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'Bad Color', color: 'not-a-hex' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('hex color');
    });

    it('POST /api/projects rejects name over 100 chars', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ name: 'x'.repeat(101) });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('100');
    });
  });

  // ── Tasks ──
  describe('Tasks API', () => {
    let projectId;
    let taskId;

    beforeAll(async () => {
      // Ensure we have a project to assign tasks to
      const projects = await request(app).get('/api/projects');
      projectId = projects.body[0]?.id || 1;
    });

    it('POST /api/tasks creates a task', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({
          title: 'Test Task',
          description: 'A test description',
          priority: 'high',
          label: 'testing',
          project_id: projectId,
          due_date: '2026-12-31'
        });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test Task');
      expect(res.body.priority).toBe('high');
      expect(res.body.due_date).toBe('2026-12-31');
      expect(res.body).toHaveProperty('id');
      taskId = res.body.id;
    });

    it('GET /api/tasks returns array including the new task', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find(t => t.id === taskId);
      expect(found).toBeDefined();
      expect(found.title).toBe('Test Task');
    });

    it('GET /api/tasks?search= filters by search term', async () => {
      const res = await request(app).get('/api/tasks?search=Test Task');
      expect(res.status).toBe(200);
      expect(res.body.some(t => t.title === 'Test Task')).toBe(true);
    });

    it('POST /api/tasks rejects empty title', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: '', project_id: projectId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('POST /api/tasks rejects invalid priority', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Bad', priority: 'super-critical', project_id: projectId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority');
    });

    it('POST /api/tasks rejects invalid due_date format', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Bad Date', due_date: 'not-a-date', project_id: projectId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('date');
    });

    it('PUT /api/tasks/:id updates task', async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .send({ title: 'Updated Task', priority: 'urgent' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Task');
      expect(res.body.priority).toBe('urgent');
    });

    it('PATCH /api/tasks/:id/move changes status', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/move`)
        .send({ status: 'inprogress' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('inprogress');
    });

    it('PATCH /api/tasks/:id/move rejects invalid status', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskId}/move`)
        .send({ status: 'invalid-status' });
      expect(res.status).toBe(400);
    });

    it('GET /api/tasks/stats/summary returns stats', async () => {
      const res = await request(app).get('/api/tasks/stats/summary');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('byPriority');
    });

    it('GET /api/tasks/recent/completed returns array', async () => {
      const res = await request(app).get('/api/tasks/recent/completed?limit=3');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('DELETE /api/tasks/:id removes task', async () => {
      const res = await request(app).delete(`/api/tasks/${taskId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PUT /api/tasks/999999 returns 404', async () => {
      const res = await request(app)
        .put('/api/tasks/999999')
        .send({ title: 'Ghost' });
      expect(res.status).toBe(404);
    });
  });
});
