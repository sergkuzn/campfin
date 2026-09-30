# Development

**Stack:** TypeScript (strict) · React 19 · Vite · plain CSS · [InstantDB](https://instantdb.com)
· `vite-plugin-pwa` · Recharts · Vitest · Biome · pnpm

Money is stored as **integer cents**; euros exist only for display.

```
src/lib/         pure budget math and row guards — no React, no DB, no strings
src/db/          the only code that touches InstantDB
src/hooks/       live queries + write callbacks per screen
src/components/  screens and presentational pieces
src/i18n/        all user-facing strings
```

## Run locally

1. **Create an InstantDB app** at [instantdb.com](https://instantdb.com) and copy its app id.
2. **Install and configure:**

   ```bash
   pnpm install
   cp .env.example .env.dev.local   # set VITE_INSTANT_APP_ID to the app id
   ```

3. **Push the schema and permissions** to that app: `pnpm db:push:dev`
4. **Start the dev server:** `pnpm vite:dev`, open it, and sign in with your email.
5. **Make yourself admin** (below) — until then you can sign in but not create a camp.

To use a single production app instead, name the file `.env.prod.local` and use the `:prod`
commands — see [environments.md](environments.md).

### Admin row

Needed once per InstantDB app, by hand: `accounts.create` is admin-only, so the app cannot
grant itself. After signing in once, open the InstantDB dashboard → the app → **Explorer** →
`accounts` → add a row:

| Field | Value |
|---|---|
| `email` | your address |
| `role` | `admin` |
| `campQuota` | any number |
| `grantedAt` | current timestamp (epoch ms) |
| `user` (link) | your `$users` row |

Everyone else is activated from the app's **Admin** screen. Joining a camp by code works
without a grant.

## Commands

Every command that touches a database names it: `dev` or `prod`.

| Command | What it does |
|---|---|
| `pnpm vite:dev` / `vite:prod` | dev server (HMR) against the dev / production DB |
| `pnpm db:push:dev` / `db:push:prod` | push `instant.schema.ts` + `instant.perms.ts` to that app |
| `pnpm build:dev` / `build:prod` | typecheck + build `dist/` locally against that DB |
| `pnpm build` | same, env from the host — **host only**, locally it has no app id |
| `pnpm preview` | serve the last build |
| `pnpm test` | Vitest, once |
| `pnpm lint` | Biome check + format + import sort (writes fixes) |
| `pnpm typecheck` | `tsc -b`, no emit |

Before calling anything done:

```bash
pnpm lint && pnpm typecheck && pnpm test
```
