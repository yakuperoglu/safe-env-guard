/**
 * safe-env-guard/init
 *
 * Side-effect entry point. Importing this module immediately runs validateEnv()
 * against the .env and .env.example files in process.cwd(). If any required
 * variables are missing or empty, a styled error is printed to stderr and the
 * process exits with code 1 — before any application code can run.
 *
 * Intended usage (first line of your app entry point):
 *
 *   import 'safe-env-guard/init';   // ES Modules
 *   require('safe-env-guard/init'); // CommonJS (if using a CJS wrapper)
 *
 * For programmatic control (custom dir, manual checks, etc.) use the main
 * entry point instead:
 *
 *   import { validateEnv, guardEnv } from 'safe-env-guard';
 */

import { validateEnv } from './index.js';

validateEnv();
