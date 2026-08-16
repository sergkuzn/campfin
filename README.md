# campfin

A local-first PWA for tracking **camp finances**, shared between several  leaders of a
volunteer work camp. Each phone keeps a full offline copy; a small shared cloud copy keeps
them in step. No personal data is stored — only counts, days, amounts and categories.

## What it does

- **Income setup** — the daily grant (people × days × rate), fixed grants, and deposits,
  each feeding a pool of money.
- **Receipts** — every expense tagged to a pool, grouped by day, with a spent/left bar per
  pool.
- **Who actually came** — real attendance beside the granted attendance, so the money for
  people who never turned up is never treated as spendable.
- **Daily burn** — how much may be spent today, and a day-by-day chart of the allowance
  against real spending.
- **Deposits & cash** — a deposit handed over and returned, and volunteers' money held for
  the organisation. Neither consumes budget.
- **Settle up** — a breakdown table that explains what goes back, exportable as JSON (a
  full backup, restorable) or CSV, and printable for accounting.

Every amount is stored as **integer cents**; euros exist only at the display edge.

## Stack

TypeScript (strict) · React 19 · Vite · plain CSS · [InstantDB](https://instantdb.com) for
data and sync · `vite-plugin-pwa` for offline · Recharts · Vitest · Biome · pnpm.

The layering is the point:

```
src/lib/         pure budget math and row guards — no React, no database, no locale strings
src/db/          the only place that touches InstantDB: writes + the client
src/hooks/       live queries + the write callbacks a screen needs
src/components/  screens and presentational pieces
src/i18n/        the dictionary; no user-facing string lives in a component
```

## Running it

```bash
pnpm install
cp .env.example .env.local        # then fill in the TEST app id
pnpm dev:test
```

`VITE_INSTANT_APP_ID` comes from the InstantDB dashboard. It is inlined at build time, so a
missing one fails loudly at startup rather than on a phone at camp.

Every command that touches a database says which one in its name — there is no unlabelled
default, because "which database am I about to write to?" should never be answered from
memory.

| Command | What it does |
|---|---|
| `pnpm dev:test` | dev server with HMR, against the **test** database |
| `pnpm dev:prod` | same, against the **production** database |
| `pnpm db:push:test` | push `instant.schema.ts` + `instant.perms.ts` to the **test** app |
| `pnpm db:push:prod` | push the same to **production** |
| `pnpm build` | typecheck + production build into `dist/` — the host's build command |
| `pnpm preview` | serve the production build locally |
| `pnpm test` | run the Vitest suite once |
| `pnpm lint` | Biome check + format + import sort (writes fixes) |
| `pnpm typecheck` | `tsc -b`, no emit |

(`pnpm test` runs the test *suite*; the test *database* is always spelled `:test` on a
`dev:`/`db:push:` command.)

Before anything is considered done:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Environments

Two InstantDB apps, one Vercel project. Which database a build talks to is decided entirely
by `VITE_INSTANT_APP_ID`; `VITE_APP_ENV` only labels it.

| Where | Branch / command | Database | Footer reads |
|---|---|---|---|
| Vercel Production | `main` | production app | `v0.3.0 · 1a2b3c4 · …` |
| Vercel Preview | `develop` (and any branch) | test app | `test · v0.3.0 · …` in amber |
| Local | `pnpm dev:test` → `.env.local` | test app | `test · …` |
| Local | `pnpm dev:prod` → `.env.prod.local` | production app | `v0.3.0 · …` |

Locally, `.env.local` holds the test app and is read in every Vite mode, so it is the
default; `pnpm dev:prod` passes `--mode prod`, which layers `.env.prod.local` over it.
Neither file is committed, and nothing in `src/` branches on the environment — only the
value of `VITE_INSTANT_APP_ID` differs. To serve a *built* bundle against production, pass
the same flag: `pnpm exec vite build --mode prod && pnpm preview`.

The `db:push:*` scripts read the app id straight out of the matching env file, because
`instant-cli` does its own env loading and knows nothing about Vite modes — left to itself
it would read `.env.local` for both and push a production schema change to the test app.

A test build also installs as its own PWA — *campfin TEST*, amber theme — so the two
home-screen icons cannot be confused.

Vercel scopes environment variables per environment: add `VITE_INSTANT_APP_ID` and
`VITE_APP_ENV` twice, once scoped to **Production** (production app id, `prod`) and once to
**Preview** + **Development** (test app id, `test`). Set the Production Branch to `main`;
`develop` then publishes to a stable `…-git-develop-….vercel.app` URL. If Deployment
Protection is on, previews sit behind a Vercel login — turn it off for this project, or the
second leader cannot open the test app.

Schema changes go to the test app first (`pnpm db:push:test`), get tried there, and only
then to production (`pnpm db:push:prod`).

## Deploying

`pnpm build` produces a fully static `dist/` — any free static host serves it (Vercel,
Netlify, Cloudflare Pages). There is no server and no router, so no redirect rules are
needed.

1. Push `instant.schema.ts` and `instant.perms.ts` once with `pnpm db:push:test`, then
   `pnpm db:push:prod`.
2. Point the host at this repository with build command `pnpm build` and output directory
   `dist`.
3. Set `VITE_INSTANT_APP_ID` and `VITE_APP_ENV` in the host's environment variables — the
   build reads them (see **Environments** above for the per-environment split).

Serve over HTTPS: the service worker (and therefore offline use) will not install
otherwise. After the first visit the app runs offline; writes queue and sync when the phone
is back online.

## Data safety

Everything lives in InstantDB's cloud copy plus each phone's IndexedDB cache. iOS evicts
IndexedDB for apps it considers unused, so the habit that matters is **Export JSON from the
settlement sheet** at the end of camp. That file restores as a complete camp through
_Restore from a file_ on the camp list.

## Licence

See [LICENSE](LICENSE).
