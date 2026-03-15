/**
 * Auth routes — Register, Login, Get current user.
 * @module server/routes/auth
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db.js';
import { requireAuth, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/guest — Create anonymous guest session
 */
router.post('/guest', (req, res) => {
  try {
    const guestId = crypto.randomBytes(4).toString('hex');
    const username = `guest_${guestId}`;
    const email = `${username}@guest.local`;
    const password_hash = 'guest-no-password';

    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, is_guest) VALUES (?, ?, ?, 1)'
    ).run(username, email, password_hash);

    const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    // Create default project for guest
    db.prepare('INSERT INTO projects (name, color, user_id) VALUES (?, ?, ?)').run('My Project', '#0ea5e9', user.id);

    // Generate JWT — same as regular login
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('taskflow_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({ user: { id: user.id, username: user.username, is_guest: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    db.prepare('INSERT INTO projects (name, color, user_id) VALUES (?, ?, ?)').run('My Project', '#0ea5e9', user.id);

    // Generate token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    // Set secure HTTP-Only cookie
    res.cookie('taskflow_token', token, {
      httpOnly: true, // Immune to XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Cross-domain in prod, local in dev
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({ user });
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

    // Set secure HTTP-Only cookie
    res.cookie('taskflow_token', token, {
      httpOnly: true, // Immune to XSS
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Vercel domains
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout — Clear authentication cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('taskflow_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me — Get current authenticated user
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const isGuest = db.prepare('SELECT is_guest FROM users WHERE id = ?').get(req.user.id);
    res.json({ ...user, is_guest: isGuest?.is_guest === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/auth/password — Change password (requires current password)
 */
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `New password must be at least ${PASSWORD_MIN} characters` });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/auth/account — Delete account and all associated data
 * Requires password confirmation for security.
 */
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Guest accounts don't need password confirmation
    if (user.is_guest !== 1) {
      if (!password) {
        return res.status(400).json({ error: 'Password is required to delete your account' });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Password is incorrect' });
      }
    }

    // Delete user — CASCADE rules handle tasks, projects, comments, activity
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);

    // Clear auth cookie
    res.clearCookie('taskflow_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/csrf-token — Generate CSRF token (double-submit cookie pattern)
 */
router.get('/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('taskflow_csrf', token, {
    httpOnly: false, // Must be readable by JS for double-submit
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ csrfToken: token });
});

export default router;
