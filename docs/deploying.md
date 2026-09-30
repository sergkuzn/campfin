# Deploying

`pnpm build` produces a static `dist/` — any free static host works (Vercel, Netlify,
Cloudflare Pages).

## First deployment

1. **Push the schema:** `pnpm db:push:prod` (run `pnpm db:push:dev` first if you have a dev app).
2. **Connect the host** to the repo — build command `pnpm build`, output directory `dist`.
3. **Set host variables:** `VITE_INSTANT_APP_ID` and `VITE_APP_ENV=prod`
   (dev split: [environments.md](environments.md)).
4. **Create your admin row** in the production app: sign in to the deployed app once, then
   follow [Admin row](development.md#admin-row). Until then, **nobody can create a camp**.

## Signup alerts (optional)

`api/request-access.ts` sends a Telegram message when someone new signs up and is waiting for
activation. Without it, check the **Admin** screen instead.

The function verifies the caller's Instant refresh token, reads the email from the verified
token, and stays silent if that address already has a grant.

### 1. Make the function reachable

| Host | Setup |
|---|---|
| Vercel | nothing — `api/` is picked up automatically |
| Netlify | re-export the handler from `netlify/functions/`, or point functions at `api/` |
| Cloudflare Pages | re-export the handler from `functions/` |

### 2. Create the bot and get the chat id

1. Telegram → **@BotFather** → `/newbot` → copy the token.
2. **Send your bot any message** (bots can't message you first — otherwise you get
   `chat not found`).
3. Get the chat id:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getUpdates" | jq '.result[0].message.chat.id'
   ```

For several admins: create a group, add the bot, post a message, run the same command. Group
ids are negative — keep the minus. New admins then just join the group.

### 3. Set host variables

**No `VITE_` prefix** — that would inline them into the public bundle.

| Variable | Value | Scope (only matters with a dev app) |
|---|---|---|
| `INSTANT_APP_ID` | same as `VITE_INSTANT_APP_ID` | per environment |
| `INSTANT_APP_ADMIN_TOKEN` | InstantDB dashboard → app → Admin token (⚠ **bypasses all permissions**) | per environment |
| `APP_ENV` | `prod` or `dev` | per environment |
| `TELEGRAM_BOT_TOKEN` | from @BotFather | shared |
| `TELEGRAM_CHAT_ID` | from step 2 | shared |

`APP_ENV` has no default: without it the function sends nothing. It labels messages
*campfin* or *campfin DEV*.
