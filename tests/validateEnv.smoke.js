/**
 * Smoke tests for validateEnv() and buildErrorReport().
 * Uses only Node.js built-ins — no test framework needed.
 *
 * validateEnv() now calls process.exit(1) on failure, so we intercept it
 * via the internal `_exit` escape hatch instead of letting the process die.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateEnv, buildErrorReport } from '../src/index.js';

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    received: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(example, env) {
  const dir = mkdtempSync(join(tmpdir(), 'safe-env-guard-'));
  writeFileSync(join(dir, '.env.example'), example, 'utf8');
  writeFileSync(join(dir, '.env'), env, 'utf8');
  return dir;
}

/**
 * Runs validateEnv() and returns { exitCode, missingKeys } without killing
 * the process. Captures stderr to extract which keys were reported missing.
 */
function runValidate(dir) {
  let exitCode = null;
  const stderrChunks = [];

  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => { stderrChunks.push(chunk); return true; };

  try {
    validateEnv(dir, {
      _exit: (code) => { exitCode = code; },
    });
  } finally {
    process.stderr.write = origWrite;
  }

  const output = stderrChunks.join('');

  // Strip all ANSI escape codes to extract plain key names from indented "    ✖  KEY" lines.
  // The header also contains "✖  safe-env-guard" but with only 1 space of indent,
  // so anchoring to exactly 4 spaces of indent selects only the key bullet lines.
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
  const missingKeys = [...plain.matchAll(/^ {4}✖ {2}(\S+)/gm)].map(m => m[1]);

  return { exitCode, missingKeys };
}

// ── validateEnv() tests ──────────────────────────────────────────────────────

console.log('\nvalidateEnv()');

// 1. All keys present and filled → no exit, no output
{
  const dir = makeTempDir(
    'APP_NAME=\nAPP_PORT=\n',
    'APP_NAME=my-app\nAPP_PORT=3000\n',
  );
  const { exitCode, missingKeys } = runValidate(dir);
  assert('does not exit when all keys are filled',  exitCode,    null);
  assert('reports no missing keys when all filled', missingKeys, []);
  rmSync(dir, { recursive: true });
}

// 2. .env is completely empty → exits(1) with all keys listed
{
  const dir = makeTempDir('FOO=\nBAR=\nBAZ=\n', '');
  const { exitCode, missingKeys } = runValidate(dir);
  assert('exits with code 1 when .env is empty',       exitCode,    1);
  assert('reports all keys when .env is empty', missingKeys, ['FOO', 'BAR', 'BAZ']);
  rmSync(dir, { recursive: true });
}

// 3. Some keys missing, some present
{
  const dir = makeTempDir(
    'HOST=\nPORT=\nSECRET=\n',
    'HOST=localhost\n',
  );
  const { exitCode, missingKeys } = runValidate(dir);
  assert('exits with code 1 for partial .env',           exitCode,    1);
  assert('reports only the missing/empty keys', missingKeys, ['PORT', 'SECRET']);
  rmSync(dir, { recursive: true });
}

// 4. Key present but value is empty string → still missing
{
  const dir = makeTempDir('DB_PASSWORD=\n', 'DB_PASSWORD=\n');
  const { exitCode, missingKeys } = runValidate(dir);
  assert('exits when value is empty string',        exitCode,    1);
  assert('treats empty value as missing key', missingKeys, ['DB_PASSWORD']);
  rmSync(dir, { recursive: true });
}

// 5. Comments and blank lines in files are ignored
{
  const dir = makeTempDir(
    '# comment\n\nKEY_A=\nKEY_B=\n',
    '# comment\n\nKEY_A=hello\nKEY_B=world\n',
  );
  const { exitCode } = runValidate(dir);
  assert('ignores comments and blank lines', exitCode, null);
  rmSync(dir, { recursive: true });
}

// 6. Missing .env file → all example keys reported, exits(1)
{
  const dir = mkdtempSync(join(tmpdir(), 'safe-env-guard-'));
  writeFileSync(join(dir, '.env.example'), 'KEY=\n', 'utf8');
  const { exitCode, missingKeys } = runValidate(dir);
  assert('handles missing .env without throwing', exitCode,    1);
  assert('reports key from example when .env absent', missingKeys, ['KEY']);
  rmSync(dir, { recursive: true });
}

// 7. Missing .env.example → does not exit (nothing to validate against)
{
  const dir = mkdtempSync(join(tmpdir(), 'safe-env-guard-'));
  writeFileSync(join(dir, '.env'), 'KEY=value\n', 'utf8');
  const { exitCode } = runValidate(dir);
  assert('handles missing .env.example without exiting', exitCode, null);
  rmSync(dir, { recursive: true });
}

// ── buildErrorReport() tests ─────────────────────────────────────────────────

console.log('\nbuildErrorReport()');

// 8. Report contains every missing key in plain text
{
  const report = buildErrorReport(['SECRET_KEY', 'DB_URL', 'API_TOKEN']);
  const plain  = report.replace(/\x1b\[[0-9;]*m/g, '');
  const found  = [...plain.matchAll(/^ {4}✖ {2}(\S+)/gm)].map(m => m[1]);
  assert('contains all missing keys in the output', found, ['SECRET_KEY', 'DB_URL', 'API_TOKEN']);
}

// 9. Report contains singular "variable" for one key
{
  const report = buildErrorReport(['ONLY_ONE']);
  const plain  = report.replace(/\x1b\[[0-9;]*m/g, '');
  assert('uses singular "variable" for one missing key', plain.includes('1 variable '), true);
}

// 10. Report contains plural "variables" for multiple keys
{
  const report = buildErrorReport(['A', 'B']);
  const plain  = report.replace(/\x1b\[[0-9;]*m/g, '');
  assert('uses plural "variables" for multiple missing keys', plain.includes('2 variables '), true);
}

// 11. Report contains ANSI escape codes (is actually coloured)
{
  const report = buildErrorReport(['KEY']);
  assert('output contains ANSI escape codes', report.includes('\x1b['), true);
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
