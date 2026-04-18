/**
 * safe-env-guard
 * A zero-dependency utility to validate and guard environment variables at runtime.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ─── ANSI styling ────────────────────────────────────────────────────────────

const A = {
  reset:       '\x1b[0m',
  bold:        '\x1b[1m',
  dim:         '\x1b[2m',
  red:         '\x1b[31m',
  yellow:      '\x1b[33m',
  cyan:        '\x1b[36m',
  brightRed:   '\x1b[91m',
  brightWhite: '\x1b[97m',
};

const boldRed       = A.bold + A.red;
const boldBrightRed = A.bold + A.brightRed;
const boldWhite     = A.bold + A.brightWhite;
const boldYellow    = A.bold + A.yellow;
const R             = A.reset;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Reads an env file from disk and returns its raw content.
 * Returns an empty string when the file does not exist.
 *
 * @param {string} filePath
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
 * @param {string} content
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

    let value = line.slice(eqIndex + 1);
    const commentIndex = value.indexOf(' #');
    if (commentIndex !== -1) value = value.slice(0, commentIndex);
    value = value.trim();

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

/**
 * Sanitizes environment key names before printing to the terminal.
 * Removes control characters (including ESC) to avoid terminal injection.
 *
 * @param {string} key
 * @returns {string}
 */
function sanitizeKeyForDisplay(key) {
  const cleaned = key.replace(/[\x00-\x1F\x7F]/g, '?');
  return cleaned === '' ? '<invalid-key>' : cleaned;
}

/**
 * Builds the styled ANSI error report string for missing environment variables.
 *
 * The box header is exactly 53 visible characters wide:
 *   " ✖  safe-env-guard  ·  Environment Validation Failed "
 *   4 + 14 + 5 + 30 = 53
 *
 * @param {string[]} missingKeys
 * @returns {string}
 */
export function buildErrorReport(missingKeys) {
  // ── Box geometry ──────────────────────────────────────────────────────────
  //
  // Visible header text (53 chars):
  //   " ✖  safe-env-guard  ·  Environment Validation Failed "
  //    ^^^^  ^^^^^^^^^^^^^^  ^  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //    4 ch  14 ch          5ch  30 ch
  //
  const BOX_INNER    = 53;
  const innerBorder  = '═'.repeat(BOX_INNER);
  const divider      = '─'.repeat(BOX_INNER);

  const topRow    = `${boldRed}╔${innerBorder}╗${R}`;
  const bottomRow = `${boldRed}╚${innerBorder}╝${R}`;

  // Header content — exactly 53 visible chars
  const headerContent =
    `${boldBrightRed} ✖  ${R}` +            //  4 visible:  " ✖  "
    `${boldWhite}safe-env-guard${R}` +       // 14 visible:  "safe-env-guard"
    `  ${A.dim}·${R}  ` +                   //  5 visible:  "  ·  "
    `${boldYellow}Environment Validation Failed ${R}`; // 30 visible

  const headerRow = `${boldRed}║${R}${headerContent}${boldRed}║${R}`;

  // ── Body ──────────────────────────────────────────────────────────────────

  const count = missingKeys.length;
  const plural = count === 1 ? 'variable' : 'variables';

  const summary =
    `  ${A.dim}${count} ${plural} declared in ${R}` +
    `${boldWhite}.env.example${R}` +
    `${A.dim} are missing or empty in ${R}` +
    `${boldWhite}.env${R}${A.dim}:${R}`;

  const keyLines = missingKeys
    .map(key => `    ${boldBrightRed}✖  ${key}${R}`)
    .join('\n');

  const hint =
    `  ${A.dim}Copy ${R}${A.cyan}.env.example${R}` +
    `${A.dim} → ${R}${A.cyan}.env${R}` +
    `${A.dim} and fill in the missing values, then restart.${R}`;

  // ── Assemble ──────────────────────────────────────────────────────────────

  return [
    '',
    topRow,
    headerRow,
    bottomRow,
    '',
    summary,
    '',
    keyLines,
    '',
    hint,
    '',
    `  ${A.dim}${divider}${R}`,
    '',
  ].join('\n');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Synchronously reads `.env` and `.env.example` from the given directory.
 * If any keys declared in `.env.example` are missing or empty in `.env`,
 * a styled error is printed to stderr and the process exits with code 1.
 * Returns normally (with no value) when all keys are present.
 *
 * @param {string} [dir=process.cwd()]
 *   Directory that contains the env files.
 * @param {{ strictExample?: boolean; _exit?: (code: number) => never }} [opts]
 *   Internal escape hatch — pass `_exit` to override `process.exit` in tests.
 *
 * @example
 * import { validateEnv } from 'safe-env-guard';
 * validateEnv(); // exits loudly if anything is missing
 */
export function validateEnv(
  dir = process.cwd(),
  { strictExample = false, _exit = process.exit } = {},
) {
  const examplePath = resolve(dir, '.env.example');
  const envPath = resolve(dir, '.env');
  const hasExampleFile = existsSync(examplePath);

  if (!hasExampleFile && strictExample) {
    process.stderr.write(
      '\n' +
      `${boldBrightRed}✖${R} ${boldWhite}safe-env-guard${R} ` +
      `${A.dim}strict mode: missing ${R}${boldWhite}.env.example${R}\n\n`,
    );
    _exit(1);
    return;
  }

  const exampleMap = parseEnvContent(readEnvFile(examplePath));
  const envMap = parseEnvContent(readEnvFile(envPath));

  const missing = [];

  for (const key of exampleMap.keys()) {
    const value = envMap.get(key);
    if (value === undefined || value === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    process.stderr.write(buildErrorReport(missing.map(sanitizeKeyForDisplay)) + '\n');
    _exit(1);
  }
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
