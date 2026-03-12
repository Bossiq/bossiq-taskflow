/**
 * Auth middleware — verifies JWT token and attaches user to request.
 * Routes can be optionally protected (allows anonymous if no token).
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-dev-secret-change-in-prod';

/**
 * Required auth — blocks request if no valid secure cookie.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.taskflow_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired secure session' });
  }
}

/**
 * Optional auth — attaches user if secure cookie present, but doesn't block.
 */
export function optionalAuth(req, res, next) {
  const token = req.cookies?.taskflow_token;
  
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = { id: payload.id, username: payload.username };
    } catch { /* ignore invalid token */ }
  }
  next();
}

export { JWT_SECRET };
