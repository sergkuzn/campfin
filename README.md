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
- **Deposits & fees** — a deposit handed over and returned, and participation fees held for
  the organisation. Neither consumes budget.
- **Financial report** — income, expenses and the cash rest, each as its own table, with the
  receipts itemised. Exportable as CSV and printable for accounting.

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
cp .env.example .env.dev.local    # then fill in the DEV app id
pnpm vite:dev
```

`VITE_INSTANT_APP_ID` comes from the InstantDB dashboard. It is inlined at build time, so a
missing one fails loudly at startup rather than on a phone at camp.

Every command that touches a database names it — `dev` or `prod`, never an unlabelled
default, because "which database am I about to write to?" should never be answered from
memory.

| Command | What it does |
|---|---|
| `pnpm vite:dev` | dev server with HMR, against the **dev** database |
| `pnpm vite:prod` | same, against the **production** database |
| `pnpm db:push:dev` | push `instant.schema.ts` + `instant.perms.ts` to the **dev** app |
| `pnpm db:push:prod` | push the same to **production** |
| `pnpm build` | typecheck + build into `dist/` — the host's build command, env from the host |
| `pnpm build:dev` | build locally against the **dev** database |
| `pnpm build:prod` | build locally against the **production** database |
| `pnpm preview` | serve the last build locally |
| `pnpm test` | run the Vitest suite once |
| `pnpm lint` | Biome check + format + import sort (writes fixes) |
| `pnpm typecheck` | `tsc -b`, no emit |

Before anything is considered done:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Environments

Two InstantDB apps, one Vercel project. Which database a build talks to is decided entirely
by `VITE_INSTANT_APP_ID`; `VITE_APP_ENV` only labels it.

| Where | Branch / command | Database | Footer reads |
|---|---|---|---|
| Vercel Production (`campfin-web.vercel.app`) | `main` | production app | `v0.3.0 · 1a2b3c4 · …` |
| Vercel Preview (`campfin-web-dev.vercel.app`) | `develop` (and any branch) | dev app | `dev · v0.3.0 · …` in amber |
| Local | `pnpm vite:dev` → `.env.dev.local` | dev app | `dev · …` |
| Local | `pnpm vite:prod` → `.env.prod.local` | production app | `v0.3.0 · …` |

Locally the app id comes from `.env.dev.local` or `.env.prod.local`, and Vite reads
`.env.[mode].local` only in that mode — so `pnpm vite:dev` sees the dev file and `pnpm vite:prod`
the production one, with no always-loaded `.env.local` underneath either. That is why there
is no mode-less local command: `pnpm build` alone (mode `production`) finds neither file and
would build a bundle with no app id. Use `pnpm build:dev` or `pnpm build:prod`, then
`pnpm preview`. On Vercel the vars arrive in the process environment instead, which Vite
merges in whatever the mode — so the host's plain `pnpm build` is correct there.

Neither local file is committed, and nothing in `src/` branches on the environment — only
the value of `VITE_INSTANT_APP_ID` differs.

The `db:push:*` scripts read the app id straight out of the matching env file, because
`instant-cli` does its own env loading and knows nothing about Vite modes — left to itself
it would read the same file for both and push a production schema change to the dev app.

A dev build also installs as its own PWA — *campfin DEV*, amber theme — so the two
home-screen icons cannot be confused.

Vercel scopes environment variables per environment: add `VITE_INSTANT_APP_ID` and
`VITE_APP_ENV` twice, once scoped to **Production** (production app id, `prod`) and once to
**Preview** + **Development** (dev app id, `dev`). Set the Production Branch to `main`;
`develop` then publishes to a stable preview URL (aliased here to `campfin-web-dev`). If Deployment
Protection is on, previews sit behind a Vercel login — turn it off for this project, or the
second leader cannot open the dev app.

Schema changes go to the dev app first (`pnpm db:push:dev`), get tried there, and only
then to production (`pnpm db:push:prod`).

## Deploying

`pnpm build` produces a fully static `dist/` — any free static host serves it (Vercel,
Netlify, Cloudflare Pages). There is no server and no router, so no redirect rules are
needed.

1. Push `instant.schema.ts` and `instant.perms.ts` once with `pnpm db:push:dev`, then
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
IndexedDB for apps it considers unused, but the cloud copy survives that — a re-installed
app signs in and pulls the camp back. The report's **Export CSV** is a record for
accounting, not a restorable backup: it holds the numbers, not the camp.

## Licence

See [LICENSE](LICENSE).
