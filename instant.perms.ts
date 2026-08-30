/**
 * Permission rules — the security boundary of this app. Pushed with `pnpm db:push`
 * alongside the schema. Rules run on Instant's servers, so they are the
 * only thing standing between a leader invited to camp A and the rows of camp B; the
 * client-side `campId` filters are convenience, never protection.
 *
 * Three ideas carry the whole file:
 *
 * 1. **Deny by default.** `$default` closes every namespace and every action that is not
 *    named below, and the `attrs` block stops clients from inventing new attributes —
 *    schema changes come from the CLI only.
 * 2. **Membership is the one authority inside a camp.** Every camp-scoped row reaches its
 *    camp through its `camp` link, and the camp reaches its members through `members`. So
 *    `auth.id in data.ref('camp.members.user.id')` is the single question asked of a pool,
 *    a source, a block, a receipt and a movement alike.
 * 3. **An `accounts` row is the authority to start one.** Signing up cannot be closed —
 *    an invited co-leader must be able to create an account before anyone knows who they
 *    are — so an account with no grant is simply inert. It can join a camp by code and do
 *    nothing else. That is what keeps other people's trial camps out of the database.
 *
 * The exception is joining: a co-leader who has been given a join code is not a member yet,
 * so `camps.view` also accepts a caller who can *name* the code via `ruleParams`. That is
 * exactly the shape of the secret — knowing the code is the invitation.
 */

import type { InstantRules } from '@instantdb/react'
// Typing the rules against the schema means a namespace typo is a compile error rather
// than a rule that silently guards nothing.
import type { AppSchema } from './instant.schema'

/**
 * The app's owner. `auth.ref` walks links *from the signed-in user's own row*, so this asks
 * the database what the caller's grant says rather than trusting anything the client sent.
 * It returns a CEL list, hence `in` rather than `==`.
 *
 * There is exactly one manual step behind it: the first admin's `accounts` row is inserted
 * by hand in the Instant dashboard, once per app. Every grant after that is made in-app.
 */
const isAdmin = "'admin' in auth.ref('$user.account.role')"

/**
 * Has this caller been activated at all? An `accounts` row exists only where the admin has
 * written one, so this is the whole invite-only boundary: it is what stops a stranger who
 * signed up from filling the database with their own camps.
 */
const hasGrant = "size(auth.ref('$user.account.id')) != 0"

/**
 * How many camps a grant allows is *not* enforced here, and the expression that tried to is
 * kept below rather than in history, because restoring it is a two-line change:
 *
 *     hasGrant && size(auth.ref('$user.createdCamps.id'))
 *                   < auth.ref('$user.account.campQuota')[0]
 *
 * Evaluating that inside `camps.create` fails on the server with "Could not evaluate
 * permission rule" for every caller that reaches it — which is only ever a non-admin, since
 * `isAdmin` short-circuits the `||` before it is read. That is why the failure stayed
 * invisible for as long as the admin was the only one creating camps. Which sub-expression
 * throws is still unidentified: both ref paths are ones the client queries successfully
 * elsewhere, which leaves comparing a `size()` against a ref'd number as the untested part.
 *
 * The quota is meanwhile counted on the client, in `src/lib/accounts.ts`. That is a real
 * downgrade — a hand-written transaction could exceed it — but it only caps how many camps
 * an already-invited leader starts. Nothing is readable or writable by anyone who was never
 * granted an account, which is the boundary that matters.
 */

const rules = {
  // Anything not named below is closed, for every action.
  $default: {
    allow: { $default: 'false' },
  },

  // No client may add or change attributes; the schema is pushed from `instant.schema.ts`.
  attrs: {
    allow: { $default: 'false' },
  },

  // A signed-in user sees their own $users row and nothing else, so co-leaders' addresses
  // stay unreadable to each other. The admin is the one exception, and a necessary one:
  // access is granted *to an address*, and this is the only namespace that knows which
  // addresses exist. Nothing else about a person is stored either way.
  // `create` runs during the magic-code signup flow itself (not just `transact`), so it
  // has to stay open — anyone with a join code needs to be able to sign up.
  $users: {
    bind: { isAdmin },
    allow: {
      // The admin needs the roster: an account is granted *to an address*, and this is the
      // only namespace that knows which addresses have ever signed in.
      view: 'isAdmin || auth.id == data.id',
      create: 'true',
      update: 'false',
      delete: 'false',
    },
  },

  // Grants. Only the admin writes them; you may read your own to find out whether the
  // create-camp form is unlocked and how much of your quota is left.
  accounts: {
    bind: { isAdmin, isMine: "auth.id in data.ref('user.id')" },
    allow: {
      view: 'isAdmin || isMine',
      create: 'isAdmin',
      update: 'isAdmin',
      delete: 'isAdmin',
    },
  },

  camps: {
    bind: {
      isAdmin,
      hasGrant,
      isMember: "auth.id in data.ref('members.user.id')",
      // `ruleParams.joinCode` is null unless the caller passes it, and joinCode is a
      // required string, so this is false for every query that doesn't name a code.
      knowsCode: 'data.joinCode == ruleParams.joinCode',
    },
    allow: {
      // Order matters: `||` short-circuits, so a member never reaches the join-code branch
      // and their own camps stay readable whatever a caller passes (or fails to pass) as a
      // rule param.
      view: 'isAdmin || isMember || knowsCode',
      // Not `isMember`: a brand-new camp has no members until the membership created in
      // the same transaction lands, and making the two rules depend on each other is a
      // good way to make camp creation unexplainably fail. A camp created without a
      // membership is invisible to everyone, including its creator — harmless, not a leak.
      //
      // `hasGrant` replaces the old `auth.id != null`: being signed in is no longer enough,
      // because signing in is something anyone can do unaided. How *many* camps the grant
      // allows is counted on the client for now — see `_withinCampQuota` above.
      create: 'isAdmin || hasGrant',
      update: 'isAdmin || isMember',
      delete: 'isAdmin || isMember',
    },
  },

  memberships: {
    bind: {
      isAdmin,
      // The row links to $users, so this is "this membership is mine".
      isMine: "auth.id in data.ref('user.id')",
      isCampMember: "auth.id in data.ref('camp.members.user.id')",
    },
    allow: {
      // Members see who else is in the camp. The UI only ever counts them.
      view: 'isAdmin || isCampMember',
      // You may only ever add *yourself*: joining is done by the joiner, not by the
      // inviter. The camp's id — learned by presenting its join code — is the capability.
      // Unchanged by the grant model on purpose: an invitation stays a private matter
      // between two leaders, needing nothing from the admin.
      create: 'isMine',
      // Role changes are not a feature yet; rotating admin means editing the row here.
      update: 'false',
      // Leaving a camp, and cleaning up when a camp is deleted.
      delete: 'isAdmin || isMine || isCampMember',
    },
  },

  // The five camp-scoped namespaces answer the same question, so they carry the same
  // block: are you in this camp, or are you the admin. Written out rather than generated:
  // a permission file should be readable as data, and `instant-cli push` reads the object,
  // not the code that built it.
  // Pools carry an extra `create` branch the other camp-scoped namespaces do not need. A
  // camp's everyday pool is written in the same transaction as the camp and the creator's
  // membership, so whether `isCampMember` can see that membership yet depends on how much
  // of its own transaction a rule observes — untested, because `camps.create` threw before
  // any pool was reached. `isCampCreator` reaches the same person one hop earlier, by the
  // link the camp itself carries.
  //
  // Precautionary rather than diagnosed, and cheap either way: it only ever admits the
  // person who is about to become the camp's admin member. Every other pool is added to a
  // camp that already exists, so membership alone is enough for them.
  pools: {
    bind: {
      isAdmin,
      isCampMember: "auth.id in data.ref('camp.members.user.id')",
      isCampCreator: "auth.id in data.ref('camp.creator.id')",
    },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember || isCampCreator',
      update: 'isAdmin || isCampMember',
      delete: 'isAdmin || isCampMember',
    },
  },

  incomeSources: {
    bind: { isAdmin, isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember',
      update: 'isAdmin || isCampMember',
      delete: 'isAdmin || isCampMember',
    },
  },

  perDiemBlocks: {
    bind: { isAdmin, isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember',
      update: 'isAdmin || isCampMember',
      delete: 'isAdmin || isCampMember',
    },
  },

  expenses: {
    bind: { isAdmin, isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember',
      update: 'isAdmin || isCampMember',
      delete: 'isAdmin || isCampMember',
    },
  },

  movements: {
    bind: { isAdmin, isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember',
      update: 'isAdmin || isCampMember',
      delete: 'isAdmin || isCampMember',
    },
  },

  pfandEntries: {
    bind: { isAdmin, isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember',
      update: 'isAdmin || isCampMember',
      delete: 'isAdmin || isCampMember',
    },
  },
} satisfies InstantRules<AppSchema>

export default rules
