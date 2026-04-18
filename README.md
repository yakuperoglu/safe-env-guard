<div align="center">

# 🛡️ safe-env-guard

**Stop your application from starting with a missing environment variable.**

[![npm version](https://img.shields.io/npm/v/safe-env-guard?color=crimson&style=flat-square)](https://www.npmjs.com/package/safe-env-guard)
[![license](https://img.shields.io/npm/l/safe-env-guard?color=blue&style=flat-square)](./LICENSE)
[![zero dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen?style=flat-square)](./package.json)
[![node](https://img.shields.io/node/v/safe-env-guard?style=flat-square)](./package.json)
[![ESM](https://img.shields.io/badge/module-ESM-orange?style=flat-square)](./package.json)

</div>

---

`safe-env-guard` reads your `.env.example` file as the source of truth and
immediately halts the application — with a clear, colourful terminal error —
if any of those keys are absent or empty in your actual `.env`.

No more silent `undefined` crashes in production. No more 3 AM debugging sessions.

```
╔═════════════════════════════════════════════════════╗
║ ✖  safe-env-guard  ·  Environment Validation Failed ║
╚═════════════════════════════════════════════════════╝

  3 variables declared in .env.example are missing or empty in .env:

    ✖  DATABASE_URL
    ✖  JWT_SECRET
    ✖  STRIPE_API_KEY

  Copy .env.example → .env and fill in the missing values, then restart.

  ─────────────────────────────────────────────────────
```

---

## Why use this?

Every Node.js project eventually ships a bug that looks like this:

```
TypeError: Cannot read properties of undefined (reading 'split')
    at parseConnectionString (db.js:14)
```

The real cause? A forgotten environment variable. Your app booted, skipped
validation, and died five stack frames deep — in production, at midnight.

`safe-env-guard` fixes this at the source:

| | Without | With `safe-env-guard` |
|---|---|---|
| **Missing `DATABASE_URL`** | App boots, crashes on first DB query | App refuses to start, tells you exactly what's missing |
| **New developer onboarding** | Silent failures, confusion | Immediate, readable error pointing to `.env.example` |
| **CI/CD pipeline** | Broken deploy discovered after traffic hits it | Pipeline fails loudly at startup, before any damage |
| **Dependencies added** | Zero overhead | Zero overhead |

### Key features

- **Zero dependencies** — No `node_modules` bloat. Uses only Node's built-in `fs` and `path`.
- **One line to activate** — A single import at the top of your entry file is all it takes.
- **Colourful, human-readable errors** — ANSI-styled output tells you exactly which keys are missing.
- **`.env.example` as the contract** — Your example file *is* the schema. No separate config needed.
- **Graceful file handling** — Missing `.env` never throws unexpectedly, and `.env.example` can be enforced with strict mode.
- **Safe terminal output** — Missing key names are sanitized before printing to avoid terminal escape injection.
- **ESM-native** — Written as a modern ES Module with full `exports` map. No transpilation required.
- **Programmatic API** — Need custom logic? Use `validateEnv()` and `guardEnv()` directly.

---

## Installation

```bash
npm install safe-env-guard
```

> Requires **Node.js ≥ 18**.

---

## Usage

### Zero-config (recommended)

Add a **single import** as the very first line of your application entry file
(e.g. `server.js`, `app.js`, `index.js`). That's it.

```js
// server.js
import 'safe-env-guard/init';   // ← must be first

import express from 'express';
import { connectDB } from './db.js';

const app = express();
// ...
```

Because ES Module `import` statements are resolved before any code runs,
`safe-env-guard/init` executes its check *before* the rest of your
application has a chance to read `process.env`. If anything is missing,
the process exits immediately with a clear error and **code 1**.

---

### Programmatic API

When you need more control — a custom directory, conditional validation,
or integration into an existing startup routine — import the functions directly.

#### `validateEnv(dir?, options?)`

Checks `.env` against `.env.example`. Prints a styled error and exits if
any keys are missing or empty. Returns normally if everything is present.
Pass `{ strictExample: true }` to also fail when `.env.example` is missing.

```js
import { validateEnv } from 'safe-env-guard';

// Uses process.cwd() by default
validateEnv();

// Or point to a specific directory
validateEnv('/path/to/project');

// Enforce that .env.example must exist
validateEnv(process.cwd(), { strictExample: true });
```

### Local demo (repo icinde hizli deneme)

Bu repoyu klonlayan kullanicilar, hazir senaryolari su komutlarla aninda deneyebilir:

```bash
npm run demo:ok
npm run demo:missing
npm run demo:strict
```

Detaylar: [`examples/local-try/README.md`](./examples/local-try/README.md)

#### `guardEnv(schema, env?)`

Validates and coerces `process.env` values against an explicit schema.
Returns a typed object or throws a descriptive error.

```js
import { guardEnv } from 'safe-env-guard';

const env = guardEnv({
  PORT:         { type: 'number',  default: '3000'  },
  DEBUG:        { type: 'boolean', default: 'false' },
  DATABASE_URL: { type: 'string',  required: true   },
  JWT_SECRET:   { type: 'string',  required: true   },
});

// env.PORT       → number
// env.DEBUG      → boolean
// env.DATABASE_URL → string
```

**Schema options per key:**

| Option | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `true` | Whether the key must be present and non-empty. |
| `default` | `string` | — | Fallback value used when the key is absent. |
| `type` | `'string'` \| `'number'` \| `'boolean'` | `'string'` | Coerces the raw string value to the target type. |

---

### Setting up `.env.example`

Your `.env.example` file is the contract between your codebase and its
configuration. Commit it to version control; keep `.env` in `.gitignore`.

```bash
# .env.example  —  committed to git, no real secrets
APP_NAME=
APP_PORT=3000
APP_DEBUG=false

DATABASE_URL=
JWT_SECRET=
STRIPE_API_KEY=
```

```bash
# .env  —  never committed, holds the real values
APP_NAME=my-app
APP_PORT=3000
APP_DEBUG=false

DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
JWT_SECRET=supersecretvalue
STRIPE_API_KEY=sk_live_...
```

`safe-env-guard` treats any key whose value is **absent or empty** in `.env`
as missing — even if it has a default in `.env.example`. This ensures
production secrets are always explicitly set.

---

## How it works

```
Import 'safe-env-guard/init'
         │
         ▼
  Read .env.example  ──►  Parse keys
         │
         ▼
     Read .env       ──►  Parse key=value pairs
         │
         ▼
  Find keys that are
  missing or empty
  in .env
         │
    ┌────┴────┐
    │         │
  None     Some found
    │         │
    ▼         ▼
 Continue   Print styled
 normally   ANSI error
              +
           process.exit(1)
```

All I/O is **synchronous** and happens at startup — there is zero runtime
overhead once your application is running.

---

## License

[MIT](./LICENSE)

---

<div align="center">

Made with care. Zero dependencies. Zero compromises.

</div>
