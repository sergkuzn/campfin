/**
 * "Somebody signed in and nobody has activated them" — sent to the admins' Telegram.
 *
 * This runs on the host, never in the browser. It holds the Instant **admin token**, which
 * bypasses every rule in `instant.perms.ts`, and a bot token that can post as the bot, so
 * two things must stay true: nothing under `src/` may import this file, and none of the
 * variables it reads may ever gain a `VITE_` prefix — Vite inlines those into the public
 * bundle.
 *
 * The caller proves who they are with their own Instant refresh token and nothing else.
 * The address in the message is the one Instant reads back off that token, never one the
 * request body claimed, so this cannot be made to announce an address the sender does not
 * own — or one that does not exist at all.
 *
 * The handler is a plain `Request` → `Response` function, which is what Vercel and Netlify
 * both hand a file in `api/`. A different host is a different wrapper around the same body.
 */

import { init } from '@instantdb/admin'
import schema from '../instant.schema'

/**
 * Server-side configuration, read per request rather than at module load. A serverless
 * platform reports a thrown import poorly — every route 500s with no clue why — whereas a
 * failed request can name the variable that is missing in the logs you actually read.
 */
function readEnv(name: string): string {
  const value = process.env[name]
  if (typeof value !== 'string' || value === '') throw new Error(`${name} is not set`)
  return value
}

/**
 * How the message names itself. The dev and production deployments send into the same chat,
 * so the label is the only thing separating "activate this person" from "activate this
 * person in the database nobody's camp lives in" — the same reason `db:push:dev` and
 * `db:push:prod` are two commands rather than one with a default.
 *
 * It matches the PWA's own naming, so a message and a home-screen icon agree.
 */
function appLabel(appEnv: string): string {
  return appEnv === 'prod' ? 'campfin' : 'campfin DEV'
}

/** The session token, pulled out of an untrusted body. */
function readToken(body: unknown): string {
  if (typeof body !== 'object' || body === null || !('token' in body)) return ''
  const token = (body as { token: unknown }).token
  return typeof token === 'string' ? token : ''
}

/**
 * One POST to the Bot API. No SDK for this: `sendMessage` takes three fields and answers
 * `{ ok: boolean }`, and a dependency for that would be more code to keep current than the
 * request it replaces.
 */
async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // No link preview: an email address otherwise renders as a card the width of the chat.
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  })
  if (!response.ok) {
    // Telegram's own wording is the useful part — `chat not found` is what you get when
    // nobody has ever messaged the bot, which is the one failure worth recognising by sight.
    throw new Error(`Telegram refused the message: ${response.status} ${await response.text()}`)
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 })

  let token = ''
  try {
    token = readToken(await request.json())
  } catch {
    return new Response(null, { status: 400 })
  }
  if (token === '') return new Response(null, { status: 400 })

  try {
    // Read before any work is done: a deployment that cannot say which database it speaks
    // for has no business sending a message about one.
    const label = appLabel(readEnv('APP_ENV'))
    const db = init({
      appId: readEnv('INSTANT_APP_ID'),
      adminToken: readEnv('INSTANT_APP_ADMIN_TOKEN'),
      schema,
    })

    // The whole authentication of this endpoint. An invalid or expired token is refused
    // here, so an anonymous POST can do nothing but waste one round trip.
    const user = await db.auth.verifyToken(token)
    if (user === null || user === undefined) return new Response(null, { status: 401 })

    // Ask the database, not the caller, whether this person still needs activating. It
    // makes the endpoint idempotent for anyone already granted: a reinstalled app or a
    // second phone re-asks, and nothing is sent.
    const { accounts } = await db.query({
      accounts: { $: { where: { email: user.email }, fields: ['id'] } },
    })
    if (accounts.length > 0) return new Response(null, { status: 204 })

    await sendTelegram(
      readEnv('TELEGRAM_BOT_TOKEN'),
      readEnv('TELEGRAM_CHAT_ID'),
      `${label}: ${user.email} signed in and has no account yet.\nOpen the app → Admin to activate them.`,
    )
    return new Response(null, { status: 202 })
  } catch (error) {
    // The message goes to the host's log, never to the caller: it can name an environment
    // variable or quote Telegram, and neither is the browser's business.
    console.error('request-access failed', error)
    return new Response(null, { status: 500 })
  }
}
