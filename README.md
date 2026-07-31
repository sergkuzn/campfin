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
cp .env.example .env.local        # then fill in VITE_INSTANT_APP_ID
pnpm dev
```

`VITE_INSTANT_APP_ID` comes from the InstantDB dashboard. It is inlined at build time, so a
missing one fails loudly at startup rather than on a phone at camp.

| Command | What it does |
|---|---|
| `pnpm dev` | dev server with HMR |
| `pnpm build` | typecheck + production build into `dist/` |
| `pnpm preview` | serve the production build locally |
| `pnpm test` | run the Vitest suite once |
| `pnpm lint` | Biome check + format + import sort (writes fixes) |
| `pnpm typecheck` | `tsc -b`, no emit |
| `pnpm db:push` | push `instant.schema.ts` + `instant.perms.ts` to InstantDB |

Before anything is considered done:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

## Deploying

`pnpm build` produces a fully static `dist/` — any free static host serves it (Vercel,
Netlify, Cloudflare Pages). There is no server and no router, so no redirect rules are
needed.

1. Push `instant.schema.ts` and `instant.perms.ts` once with `pnpm db:push`.
2. Point the host at this repository with build command `pnpm build` and output directory
   `dist`.
3. Set `VITE_INSTANT_APP_ID` in the host's environment variables — the build reads it.

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
