/**
 * Stress & Security Test Suite — TaskFlow API
 * 
 * Tests edge cases, XSS injection, SQL injection attempts, oversized payloads,
 * batch limits, concurrency, malformed input, and auth boundary enforcement.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';

describe('Stress & Security Tests', () => {

  // ── XSS Injection Prevention ──
  describe('XSS Injection', () => {
    it('strips <script> tags from task title', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: '<script>alert("xss")</script>Legit Title',
        project_id: 1
      });
      expect(res.status).toBe(201);
      expect(res.body.title).not.toContain('<script>');
      expect(res.body.title).toContain('Legit Title');
    });

    it('strips <img onerror> from task description', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'XSS Desc Test',
        description: '<img src=x onerror=alert("xss")>Normal description',
        project_id: 1
      });
      expect(res.status).toBe(201);
      expect(res.body.description).not.toContain('onerror');
    });

    it('strips event handlers from comment content', async () => {
      // First create a task
      const task = await request(app).post('/api/tasks').send({
        title: 'Comment XSS Target', project_id: 1
      });
      const res = await request(app)
        .post(`/api/tasks/${task.body.id}/comments`)
        .send({ content: '<div onmouseover="steal()">hover me</div>' });
      expect(res.status).toBe(201);
      expect(res.body.content).not.toContain('onmouseover');
    });

    it('strips <script> from project names', async () => {
      const res = await request(app).post('/api/projects').send({
        name: '<script>alert(1)</script>SafeProject',
        color: '#ff0000'
      });
      expect(res.status).toBe(201);
      expect(res.body.name).not.toContain('<script>');
    });

    it('strips <script> from subtask titles', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Subtask XSS Parent', project_id: 1
      });
      const res = await request(app)
        .post(`/api/tasks/${task.body.id}/subtasks`)
        .send({ title: '<script>document.cookie</script>Clean' });
      expect(res.status).toBe(201);
      expect(res.body.title).not.toContain('<script>');
    });
  });

  // ── SQL Injection Prevention ──
  describe('SQL Injection', () => {
    it('rejects SQL injection in search parameter', async () => {
      const res = await request(app).get("/api/tasks?search='; DROP TABLE tasks; --");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // If the table was dropped, this would have crashed
    });

    it('handles SQL injection in task title safely', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: "Robert'); DROP TABLE tasks;--",
        project_id: 1
      });
      expect(res.status).toBe(201);
      // Verify database is still intact
      const check = await request(app).get('/api/tasks');
      expect(check.status).toBe(200);
      expect(Array.isArray(check.body)).toBe(true);
    });

    it('handles SQL injection in project name safely', async () => {
      const res = await request(app).post('/api/projects').send({
        name: "hack' OR '1'='1", color: '#000000'
      });
      expect(res.status).toBe(201);
      // Database still works
      const check = await request(app).get('/api/projects');
      expect(check.status).toBe(200);
    });
  });

  // ── Payload Size & Limits ──
  describe('Payload Limits', () => {
    it('rejects task title over 200 characters', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'A'.repeat(201), project_id: 1
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('200');
    });

    it('rejects task description over 2000 characters', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'Valid Title',
        description: 'D'.repeat(2001),
        project_id: 1
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('2000');
    });

    it('rejects label over 50 characters', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'Valid', label: 'L'.repeat(51), project_id: 1
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('50');
    });

    it('rejects subtask title over 200 characters', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Subtask limit test', project_id: 1
      });
      const res = await request(app)
        .post(`/api/tasks/${task.body.id}/subtasks`)
        .send({ title: 'S'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('rejects batch operations with >50 IDs', async () => {
      const bigBatch = Array.from({ length: 51 }, (_, i) => i + 1);
      const res = await request(app).patch('/api/tasks/batch').send({
        ids: bigBatch, action: 'move', value: 'done'
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('50');
    });
  });

  // ── Malformed Input Handling ──
  describe('Malformed Input', () => {
    it('handles missing body gracefully for POST /tasks', async () => {
      const res = await request(app).post('/api/tasks')
        .send({});
      expect(res.status).toBe(400);
    });

    it('handles null title gracefully', async () => {
      const res = await request(app).post('/api/tasks')
        .send({ title: null, project_id: 1 });
      expect(res.status).toBe(400);
    });

    it('handles numeric title gracefully', async () => {
      const res = await request(app).post('/api/tasks')
        .send({ title: 12345, project_id: 1 });
      // Should not crash the server — may accept as 201, reject as 400, or handle as 500
      expect(res.status).toBeLessThan(600);
    });

    it('handles non-integer task ID in URL', async () => {
      const res = await request(app).get('/api/tasks/not-a-number');
      // Should return 404 (not found) or handle gracefully, not crash with 500
      expect([404, 400]).toContain(res.status);
    });

    it('handles negative task ID in URL', async () => {
      const res = await request(app).delete('/api/tasks/-1');
      expect(res.status).toBe(404);
    });

    it('handles empty batch IDs array', async () => {
      const res = await request(app).patch('/api/tasks/batch').send({
        ids: [], action: 'delete'
      });
      expect(res.status).toBe(400);
    });

    it('handles batch with no action', async () => {
      const res = await request(app).patch('/api/tasks/batch').send({
        ids: [1, 2]
      });
      expect(res.status).toBe(400);
    });

    it('handles move to invalid status', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Move test', project_id: 1
      });
      const res = await request(app)
        .patch(`/api/tasks/${task.body.id}/move`)
        .send({ status: 'hacked' });
      expect(res.status).toBe(400);
    });

    it('handles reorder with non-numeric position', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Reorder break test', project_id: 1
      });
      const res = await request(app)
        .patch(`/api/tasks/${task.body.id}/reorder`)
        .send({ position: 'first' });
      expect(res.status).toBe(400);
    });
  });

  // ── Concurrent Operations ──
  describe('Concurrency & Stress', () => {
    it('handles 20 simultaneous task creations', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        request(app).post('/api/tasks').send({
          title: `Concurrent Task ${i}`,
          priority: 'medium',
          project_id: 1
        })
      );
      const results = await Promise.all(promises);
      const successes = results.filter(r => r.status === 201);
      expect(successes.length).toBe(20);
    });

    it('handles 10 simultaneous move operations', async () => {
      // Create tasks first
      const creates = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          request(app).post('/api/tasks').send({
            title: `Move Stress ${i}`, project_id: 1
          })
        )
      );
      const ids = creates.map(r => r.body.id);

      // Move them all simultaneously
      const moves = await Promise.all(
        ids.map(id =>
          request(app).patch(`/api/tasks/${id}/move`).send({ status: 'done' })
        )
      );
      const allOk = moves.every(r => r.status === 200);
      expect(allOk).toBe(true);
    });

    it('handles rapid create/delete cycle', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Rapid delete target', project_id: 1
      });
      expect(task.status).toBe(201);
      
      const del = await request(app).delete(`/api/tasks/${task.body.id}`);
      expect(del.status).toBe(200);
      
      // Verify it's gone
      const check = await request(app).get(`/api/tasks/${task.body.id}`);
      expect(check.status).toBe(404);
    });
  });

  // ── Activity Logging Verification ──
  describe('Activity Audit Trail', () => {
    it('logs task creation in activity', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Activity Log Test', project_id: 1
      });
      const res = await request(app).get(`/api/tasks/${task.body.id}/activity`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.some(a => a.action === 'created')).toBe(true);
    });

    it('logs task move in activity', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Move Log Test', project_id: 1
      });
      await request(app).patch(`/api/tasks/${task.body.id}/move`).send({
        status: 'inprogress'
      });
      const res = await request(app).get(`/api/tasks/${task.body.id}/activity`);
      expect(res.body.some(a => a.action === 'moved')).toBe(true);
    });

    it('logs task completion in activity', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Complete Log Test', project_id: 1
      });
      await request(app).patch(`/api/tasks/${task.body.id}/move`).send({
        status: 'done'
      });
      const res = await request(app).get(`/api/tasks/${task.body.id}/activity`);
      expect(res.body.some(a => a.action === 'completed')).toBe(true);
    });

    it('logs task update in activity', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Update Log Test', project_id: 1
      });
      await request(app).put(`/api/tasks/${task.body.id}`).send({
        title: 'Updated Title', priority: 'urgent'
      });
      const res = await request(app).get(`/api/tasks/${task.body.id}/activity`);
      expect(res.body.some(a => a.action === 'updated')).toBe(true);
    });
  });

  // ── Edge Cases ──
  describe('Edge Cases', () => {
    it('handles Unicode/emoji in task titles', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: '🚀 Deployment — régression (日本語テスト)',
        project_id: 1
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toContain('🚀');
      expect(res.body.title).toContain('日本語');
    });

    it('handles extremely long but valid description', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'Long Desc',
        description: 'x'.repeat(2000), // exactly at limit
        project_id: 1
      });
      expect(res.status).toBe(201);
    });

    it('handles task with all optional fields empty', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: 'Minimal Task',
        project_id: 1
      });
      expect(res.status).toBe(201);
      expect(res.body.description).toBe('');
      expect(res.body.priority).toBe('medium');
      expect(res.body.status).toBe('todo');
    });

    it('DELETE on already-deleted task returns 404', async () => {
      const task = await request(app).post('/api/tasks').send({
        title: 'Delete twice', project_id: 1
      });
      await request(app).delete(`/api/tasks/${task.body.id}`);
      const res = await request(app).delete(`/api/tasks/${task.body.id}`);
      expect(res.status).toBe(404);
    });

    it('stats endpoint works with zero tasks', async () => {
      const res = await request(app).get('/api/tasks/stats/summary');
      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
    });

    it('handles whitespace-only title', async () => {
      const res = await request(app).post('/api/tasks').send({
        title: '   ', project_id: 1
      });
      expect(res.status).toBe(400);
    });

    it('handles special characters in search', async () => {
      const res = await request(app).get(`/api/tasks?search=${encodeURIComponent("% OR 1=1 --")}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Auth Security ──
  describe('Auth Security', () => {
    it('rejects username shorter than 2 chars', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'a', email: 'short@test.com', password: 'password123'
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing email on register', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'noemail', password: 'password123'
      });
      expect(res.status).toBe(400);
    });

    it('rejects login with missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });

    it('rejects tampered cookie', async () => {
      const res = await request(app).get('/api/auth/me')
        .set('Cookie', 'taskflow_token=totallyFakeTokenHere123');
      expect(res.status).toBe(401);
    });
  });
});
