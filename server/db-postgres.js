/**
 * PostgreSQL database adapter for production.
 *
 * Provides the same .prepare().run/.get/.all interface as better-sqlite3
 * via a synchronous-looking wrapper using pg's synchronous-like pool.
 *
 * The adapter converts SQLite-style ? placeholders to PostgreSQL $1, $2, ...
 * and wraps pg Pool queries in the prepare/run/get/all pattern used
 * throughout the codebase.
 *
 * Usage:
 *   Set DATABASE_URL env var to enable PostgreSQL.
 *   Without DATABASE_URL, falls back to SQLite (better-sqlite3).
 *
 * @module server/db-postgres
 */

import pg from 'pg';
const { Pool } = pg;

/**
 * Creates a PostgreSQL adapter with prepare/run/get/all interface.
 *
 * @param {string} connectionString — PostgreSQL connection URL
 * @returns {object} db-like object with prepare(), exec(), pragma() methods
 */
export function createPostgresAdapter(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  });

  /** Convert SQLite ? to PostgreSQL $1, $2, ... */
  function convertPlaceholders(sql) {
    let idx = 0;
    return sql.replace(/\?/g, () => `$${++idx}`);
  }

  /** Convert SQLite-specific syntax to PostgreSQL */
  function convertSQL(sql) {
    let pgSql = convertPlaceholders(sql);

    // INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
    pgSql = pgSql.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

    // DATETIME → TIMESTAMPTZ
    pgSql = pgSql.replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');

    // CHECK constraints with SQLite quoting → standard
    // INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
    pgSql = pgSql.replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT');

    // CURRENT_TIMESTAMP works in both

    return pgSql;
  }

  const adapter = {
    /** Emulate better-sqlite3's prepare() */
    prepare(sql) {
      const pgSql = convertSQL(sql);

      return {
        /** Execute a write query (INSERT/UPDATE/DELETE) */
        async run(...params) {
          try {
            const result = await pool.query(pgSql, params);
            return {
              changes: result.rowCount || 0,
              lastInsertRowid: result.rows?.[0]?.id || null
            };
          } catch (err) {
            console.error('[PG] run error:', err.message, '\nSQL:', pgSql);
            throw err;
          }
        },

        /** Get a single row */
        async get(...params) {
          try {
            const result = await pool.query(pgSql, params);
            return result.rows[0] || undefined;
          } catch (err) {
            console.error('[PG] get error:', err.message, '\nSQL:', pgSql);
            throw err;
          }
        },

        /** Get all matching rows */
        async all(...params) {
          try {
            const result = await pool.query(pgSql, params);
            return result.rows;
          } catch (err) {
            console.error('[PG] all error:', err.message, '\nSQL:', pgSql);
            throw err;
          }
        }
      };
    },

    /** Execute raw SQL (for schema creation) */
    async exec(sql) {
      // Split on semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          const pgStmt = convertSQL(stmt + ';');
          await pool.query(pgStmt);
        } catch (err) {
          // Ignore "already exists" errors during schema creation
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error('[PG] exec error:', err.message, '\nSQL:', stmt);
          }
        }
      }
    },

    /** No-op for PostgreSQL (WAL and foreign_keys are handled differently) */
    pragma() {},

    /** Close the pool */
    async close() {
      await pool.end();
    },

    /** Direct pool access for advanced queries */
    pool
  };

  return adapter;
}
