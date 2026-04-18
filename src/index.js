/**
 * safe-env-guard
 * A zero-dependency utility to validate and guard environment variables at runtime.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Reads an env file from disk and returns its raw content.
 * Returns an empty string when the file does not exist, so callers can
 * treat a missing .env the same as an empty one without crashing.
 *
 * @param {string} filePath  Absolute path to the file.
 * @returns {string}
 */
function readEnvFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

/**
 * Parses the content of a .env-style file into a Map of key → value.
 *
 * Rules:
 *  - Lines that are empty or start with `#` are ignored.
 *  - Each line must follow the `KEY=VALUE` format; lines without `=` are ignored.
 *  - Keys are trimmed; values are trimmed and may be empty strings.
 *  - Inline `#` comments after the value are stripped.
 *  - Surrounding single or double quotes on values are removed.
 *
 * @param {string} content  Raw file content.
 * @returns {Map<string, string>}
 */
function parseEnvContent(content) {
  const map = new Map();

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (key === '') continue;

    // Strip inline comment, then trim whitespace from value.
    let value = line.slice(eqIndex + 1);
    const commentIndex = value.indexOf(' #');
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex);
    }
    value = value.trim();

    // Remove surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    map.set(key, value);
  }

  return map;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Synchronously reads `.env` and `.env.example` from the given directory,
 * then returns the list of keys that are declared in `.env.example` but are
 * either absent from `.env` or present with an empty value.
 *
 * @param {string} [dir=process.cwd()]
 *   The directory that contains both env files.
 *   Defaults to the current working directory so the function works
 *   correctly when called from a project's root.
 * @returns {string[]}  Array of missing/empty key names (may be empty).
 *
 * @example
 * import { validateEnv } from 'safe-env-guard';
 *
 * const missing = validateEnv();
 * if (missing.length > 0) {
 *   console.error('Missing env vars:', missing);
 *   process.exit(1);
 * }
 */
export function validateEnv(dir = process.cwd()) {
  const examplePath = resolve(dir, '.env.example');
  const envPath = resolve(dir, '.env');

  const exampleMap = parseEnvContent(readEnvFile(examplePath));
  const envMap = parseEnvContent(readEnvFile(envPath));

  const missing = [];

  for (const key of exampleMap.keys()) {
    const value = envMap.get(key);
    // Missing entirely OR present but empty.
    if (value === undefined || value === '') {
      missing.push(key);
    }
  }

  return missing;
}

/**
 * Reads and validates environment variables against a schema definition.
 *
 * @param {Record<string, { required?: boolean; default?: string; type?: 'string' | 'number' | 'boolean' }>} schema
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {Record<string, string | number | boolean>}
 * @throws {Error} When required variables are missing or values fail type coercion.
 */
export function guardEnv(schema, env = process.env) {
  const errors = [];
  const result = {};

  for (const [key, options] of Object.entries(schema)) {
    const raw = env[key] ?? options.default;

    if (raw === undefined || raw === '') {
      if (options.required !== false) {
        errors.push(`Missing required environment variable: "${key}"`);
      }
      continue;
    }

    const type = options.type ?? 'string';

    if (type === 'number') {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        errors.push(`Environment variable "${key}" must be a number, got: "${raw}"`);
        continue;
      }
      result[key] = num;
    } else if (type === 'boolean') {
      const lower = raw.toLowerCase();
      if (lower !== 'true' && lower !== 'false') {
        errors.push(`Environment variable "${key}" must be "true" or "false", got: "${raw}"`);
        continue;
      }
      result[key] = lower === 'true';
    } else {
      result[key] = raw;
    }
  }

  if (errors.length > 0) {
    throw new Error(`safe-env-guard validation failed:\n  - ${errors.join('\n  - ')}`);
  }

  return result;
}
