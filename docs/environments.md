# Environments

One InstantDB app — **production** — is enough. A second **dev** app is optional, for trying
changes without touching real camp data.

`VITE_INSTANT_APP_ID` picks the database; `VITE_APP_ENV` (`prod` / `dev`) only labels it.
Nothing in `src/` branches on the environment.

| Environment | Source | Database | Footer |
|---|---|---|---|
| Production | branch `main` | production | `v0.3.0 · 1a2b3c4 · …` |
| Dev *(optional)* | branch `dev-preview` | dev | `dev · v0.3.0 · …` (amber) |
| Local | `pnpm vite:dev` + `.env.dev.local` | dev | `dev · …` |
| Local | `pnpm vite:prod` + `.env.prod.local` | production | `v0.3.0 · …` |

A dev build installs as a separate PWA, *campfin DEV*, with an amber theme.

## Local env files

| File | Read by | Contains |
|---|---|---|
| `.env.dev.local` | `vite:dev`, `build:dev`, `db:push:dev` | dev app id |
| `.env.prod.local` | `vite:prod`, `build:prod`, `db:push:prod` | production app id |

Both are gitignored. Without a dev app you only need `.env.prod.local`.

- Vite loads `.env.[mode].local` only in that mode, and there is no shared `.env.local`.
  So a local `pnpm build` finds **no** app id — use `build:dev` / `build:prod`, then
  `pnpm preview`. On a host, `pnpm build` is correct: the variables come from the host.
- `db:push:*` pass the app id from the matching file explicitly, because `instant-cli`
  ignores Vite modes and would otherwise push to the wrong app.

## Hosting (Vercel as example)

| Setting | Production | Dev *(optional)* |
|---|---|---|
| Branch | `main` (production branch) | `dev-preview`, with its own domain |
| `VITE_INSTANT_APP_ID` | production app id | dev app id — scope **Preview** + **Development** |
| `VITE_APP_ENV` | `prod` | `dev` — same scope |

- `vercel.json` disables deployments for every other branch (`develop`, feature branches).
- Turn off **Deployment Protection** for previews, or the second leader can't open the dev site.
- Netlify / Cloudflare Pages: same setup under other names.

## CI and schema pushes

| Workflow | Trigger | Does |
|---|---|---|
| `.github/workflows/ci.yml` | every branch push | lint, typecheck, tests, build — no secrets |
| `.github/workflows/deploy-db.yml` | push to `main` / `dev-preview` touching `instant.schema.ts` or `instant.perms.ts` | pushes both files to that branch's app |

`deploy-db.yml` needs a GitHub environment per app, each with secrets `INSTANT_APP_ID` and
`INSTANT_APP_ADMIN_TOKEN`:

- `production` (for `main`) — add a **required reviewer**, so prod pushes wait for approval.
- `development` (for `dev-preview`) — skip it if there is no dev app.

Rules:

1. Schema changes go to dev first (`pnpm db:push:dev`), then production (`pnpm db:push:prod`).
2. Additive changes are safe to deploy automatically.
3. **Removing or renaming an attribute:** push by hand *before* merging — old clients may
   still read it.
