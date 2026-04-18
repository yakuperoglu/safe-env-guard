/**
 * safe-env-guard
 * A zero-dependency utility to validate and guard environment variables at runtime.
 */

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
