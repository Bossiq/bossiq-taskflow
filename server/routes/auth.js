/**
 * Auth routes — Register, Login, Get current user.
 * @module server/routes/auth
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { requireAuth, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register — Create a new account
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate
    const errors = [];
    if (!username || username.trim().length < USERNAME_MIN) {
      errors.push(`Username must be at least ${USERNAME_MIN} characters`);
    }
    if (username && username.length > USERNAME_MAX) {
      errors.push(`Username must be ${USERNAME_MAX} characters or less`);
    }
    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      errors.push('Valid email is required');
    }
    if (!password || password.length < PASSWORD_MIN) {
      errors.push(`Password must be at least ${PASSWORD_MIN} characters`);
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    // Check uniqueness
    const existing = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username.trim().toLowerCase(), email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    // Hash password and create user
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
    ).run(username.trim().toLowerCase(), email.trim().toLowerCase(), password_hash);

    const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    // Create a default project for new user
    db.prepare('INSERT INTO projects (name, color, user_id) VALUES (?, ?, ?)').run('My Project', '#6366f1', user.id);

    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login — Authenticate and get token
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user (by username or email)
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ? OR email = ?'
    ).get(username.trim().toLowerCase(), username.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me — Get current authenticated user
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
