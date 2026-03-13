/**
 * XSS sanitization middleware for Express.
 * Strips HTML tags from all string values in request body.
 * @module middleware/sanitize
 */

/**
 * Recursively sanitize all string values in an object by stripping HTML tags.
 * @param {*} value - The value to sanitize
 * @returns {*} The sanitized value
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value
      .replace(/<[^>]*>/g, '')                          // Strip raw HTML tags
      .replace(/&lt;[^>]*(?:>|&gt;)/gi, '')             // Strip partially-encoded tags (xss-clean)
      .replace(/&lt;[^&]*&gt;/gi, '')                   // Strip fully-encoded tags
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

/**
 * Express middleware that sanitizes all string fields in req.body
 * to prevent XSS attacks by stripping HTML tags.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}
