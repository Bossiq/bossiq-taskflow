/**
 * Auth middleware — verifies JWT token AND validates user exists in DB.
 *
 * A valid JWT alone isn't enough — the user record may have been deleted
 * (DB reset, account deletion, etc.). If the user no longer exists,
 * the stale cookie is cleared and the request is treated as unauthenticated.
 */
import jwt from 'jsonwebtoken';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-dev-secret-change-in-prod';

/** Cookie options for clearing stale tokens */
const CLEAR_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
};

/**
 * Verify that a decoded JWT user actually exists in the database.
 * Returns the user row if found, undefined if not.
 */
async function verifyUserExists(userId) {
  try {
    return await db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  } catch {
    return undefined;
  }
}

/**
 * Required auth — blocks request if no valid secure cookie or user doesn't exist.
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.taskflow_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Verify user still exists in the database
    const user = await verifyUserExists(payload.id);
    if (!user) {
      // User was deleted — clear the stale cookie
      res.clearCookie('taskflow_token', CLEAR_COOKIE_OPTS);
      return res.status(401).json({ error: 'Session expired — please sign in again' });
    }

    req.user = { id: user.id, username: user.username };
    next();
  } catch {
    res.clearCookie('taskflow_token', CLEAR_COOKIE_OPTS);
    return res.status(401).json({ error: 'Invalid or expired secure session' });
  }
}

/**
 * Optional auth — attaches user if secure cookie present AND user exists, but doesn't block.
 * If user was deleted, silently clears the stale cookie.
 */
export async function optionalAuth(req, res, next) {
  const token = req.cookies?.taskflow_token;

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);

      // Verify user still exists in the database
      const user = await verifyUserExists(payload.id);
      if (user) {
        req.user = { id: user.id, username: user.username };
      } else {
        // User was deleted — clear the stale cookie silently
        res.clearCookie('taskflow_token', CLEAR_COOKIE_OPTS);
      }
    } catch {
      // Invalid/expired token — clear it
      res.clearCookie('taskflow_token', CLEAR_COOKIE_OPTS);
    }
  }
  next();
}

export { JWT_SECRET };
