/**
 * Quick smoke test for validateEnv().
 * Writes temporary .env files to a temp directory and asserts results.
 * Uses only Node.js built-ins — no test framework needed.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateEnv } from '../src/index.js';

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

// ── Test cases ───────────────────────────────────────────────────────────────

console.log('\nvalidateEnv()');

// 1. All keys present and filled → no missing keys
{
  const dir = makeTempDir(
    'APP_NAME=\nAPP_PORT=\n',
    'APP_NAME=my-app\nAPP_PORT=3000\n',
  );
  assert('returns [] when all keys are filled', validateEnv(dir), []);
  rmSync(dir, { recursive: true });
}

// 2. .env is completely empty → all example keys are missing
{
  const dir = makeTempDir('FOO=\nBAR=\nBAZ=\n', '');
  assert('returns all keys when .env is empty', validateEnv(dir), ['FOO', 'BAR', 'BAZ']);
  rmSync(dir, { recursive: true });
}

// 3. Some keys missing, some present
{
  const dir = makeTempDir(
    'HOST=\nPORT=\nSECRET=\n',
    'HOST=localhost\n',
  );
  assert('returns only the missing/empty keys', validateEnv(dir), ['PORT', 'SECRET']);
  rmSync(dir, { recursive: true });
}

// 4. Key present but value is empty string → still missing
{
  const dir = makeTempDir('DB_PASSWORD=\n', 'DB_PASSWORD=\n');
  assert('treats empty value as missing', validateEnv(dir), ['DB_PASSWORD']);
  rmSync(dir, { recursive: true });
}

// 5. Comments and blank lines in files are ignored
{
  const dir = makeTempDir(
    '# comment\n\nKEY_A=\nKEY_B=\n',
    '# comment\n\nKEY_A=hello\nKEY_B=world\n',
  );
  assert('ignores comments and blank lines', validateEnv(dir), []);
  rmSync(dir, { recursive: true });
}

// 6. Missing .env file → all example keys are missing (no crash)
{
  const dir = mkdtempSync(join(tmpdir(), 'safe-env-guard-'));
  writeFileSync(join(dir, '.env.example'), 'KEY=\n', 'utf8');
  // .env intentionally not created
  assert('handles missing .env without throwing', validateEnv(dir), ['KEY']);
  rmSync(dir, { recursive: true });
}

// 7. Missing .env.example → returns [] (nothing to validate against)
{
  const dir = mkdtempSync(join(tmpdir(), 'safe-env-guard-'));
  writeFileSync(join(dir, '.env'), 'KEY=value\n', 'utf8');
  assert('handles missing .env.example without throwing', validateEnv(dir), []);
  rmSync(dir, { recursive: true });
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
