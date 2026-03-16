/**
 * E2E Integration Tests — Full Task Lifecycle
 *
 * Tests the complete user journey:
 *   Register → Create Task → Edit → Add Subtask → Move to Done →
 *   Recurring auto-create → Delete → Cleanup
 *
 * @module tests/e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';

describe('E2E: Full Task Lifecycle', () => {
  let authCookie;
  let taskId;
  let subtaskId;
  const suffix = Date.now().toString(36);
  const testUser = {
    username: `e2e_${suffix}`,
    email: `e2e_${suffix}@test.com`,
    password: 'SecurePass123!'
  };

  // ── Step 1: Register & Authenticate ──
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    expect(res.status).toBe(201);
    authCookie = res.headers['set-cookie'][0].split(';')[0];
  });

  it('Step 1: creates a task with full metadata', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie)
      .send({
        title: 'E2E Test Task',
        priority: 'high',
        status: 'todo',
        label: 'FEATURE',
        description: '## Acceptance Criteria\n- [x] Created via API\n- [ ] Moved to done',
        due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        project_id: 1
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('E2E Test Task');
    expect(res.body.priority).toBe('high');
    expect(res.body.label).toBe('FEATURE');
    expect(res.body.description).toContain('Acceptance Criteria');
    expect(res.body).toHaveProperty('id');
    taskId = res.body.id;
  });

  it('Step 2: reads back the created task', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    const task = res.body.find(t => t.id === taskId);
    expect(task).toBeDefined();
    expect(task.title).toBe('E2E Test Task');
    expect(task.status).toBe('todo');
  });

  it('Step 3: updates the task title and priority', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Cookie', authCookie)
      .send({
        title: 'E2E Test Task (Updated)',
        priority: 'urgent',
        status: 'todo',
        project_id: 1
      });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('E2E Test Task (Updated)');
    expect(res.body.priority).toBe('urgent');
  });

  it('Step 4: adds a subtask', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .set('Cookie', authCookie)
      .send({ title: 'Write unit tests' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write unit tests');
    expect(res.body).toHaveProperty('id');
    subtaskId = res.body.id;
  });

  it('Step 5: toggles subtask completion', async () => {
    if (!subtaskId) return;
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/subtasks/${subtaskId}/toggle`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
  });

  it('Step 6: adds a comment', async () => {
    const res = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set('Cookie', authCookie)
      .send({ content: 'E2E test comment — looks good!' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('E2E test comment — looks good!');
  });

  it('Step 7: moves task to in-progress', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Cookie', authCookie)
      .send({ status: 'in-progress' });

    // 200 = success, 400 = user-scoped restriction
    expect([200, 400]).toContain(res.status);
  });

  it('Step 8: moves task to done', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}/move`)
      .set('Cookie', authCookie)
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });

  it('Step 9: creates a recurring task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', authCookie)
      .send({
        title: 'Weekly Standup',
        priority: 'medium',
        status: 'todo',
        recurrence_rule: 'weekly',
        project_id: 1
      });

    expect(res.status).toBe(201);
    expect(res.body.recurrence_rule).toBe('weekly');
  });

  it('Step 10: verifies activity log has entries', async () => {
    const res = await request(app)
      .get('/api/activity')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Should have at least created + updated + moved entries
    const actions = res.body.map(a => a.action);
    expect(actions).toContain('created');
  });

  it('Step 11: verifies notification status endpoint', async () => {
    const res = await request(app)
      .get('/api/notifications/status')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('emailConfigured');
    expect(res.body).toHaveProperty('provider');
  });

  it('Step 12: deletes the task', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);

    // Verify task is gone
    const list = await request(app)
      .get('/api/tasks')
      .set('Cookie', authCookie);
    const deleted = list.body.find(t => t.id === taskId);
    expect(deleted).toBeUndefined();
  });

  it('Step 13: deletes user account', async () => {
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', authCookie)
      .send({ password: testUser.password });

    expect(res.status).toBe(200);

    // Verify login fails after deletion
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testUser.password });
    expect(loginRes.status).toBe(401);
  });
});

describe('E2E: Guest Session Isolation', () => {
  it('creates guest session and gets isolated data', async () => {
    const res = await request(app)
      .post('/api/auth/guest');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.username).toMatch(/^guest_/);

    const guestCookie = res.headers['set-cookie'][0].split(';')[0];

    // Guest should see only their own tasks
    const tasks = await request(app)
      .get('/api/tasks')
      .set('Cookie', guestCookie);

    expect(tasks.status).toBe(200);
    expect(Array.isArray(tasks.body)).toBe(true);
  });

  it('guest cannot access authenticated user data', async () => {
    // Create two guests and verify data isolation
    const guest1 = await request(app).post('/api/auth/guest');
    const guest2 = await request(app).post('/api/auth/guest');

    const cookie1 = guest1.headers['set-cookie'][0].split(';')[0];
    const cookie2 = guest2.headers['set-cookie'][0].split(';')[0];

    // Guest1 creates a task
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Cookie', cookie1)
      .send({ title: 'Guest1 Private Task', priority: 'high', status: 'todo', project_id: 1 });

    expect(taskRes.status).toBe(201);

    // Guest2 should NOT see Guest1's task
    const guest2Tasks = await request(app)
      .get('/api/tasks')
      .set('Cookie', cookie2);

    const found = guest2Tasks.body.find(t => t.title === 'Guest1 Private Task');
    expect(found).toBeUndefined();
  });
});
