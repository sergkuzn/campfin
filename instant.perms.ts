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
 * May this caller start another camp? Two conditions, and the order matters because CEL's
 * `&&` short-circuits: there must *be* a grant before its quota can be read, or the index
 * on the second clause would blow up for every unactivated account.
 *
 * `size(auth.ref('$user.createdCamps.id'))` counts the camps this user has created — the
 * only kind of counting a rule can do. Camps written before the `creator` link existed
 * count for nobody, so an old camp never eats into a quota.
 *
 * The comparison is `<` on the assumption that the camp being created is not yet part of
 * that count. Instant's own quota example writes `<= 2` for "at most 2", which reads as the
 * opposite, and the two differ by exactly one camp — so this is worth pinning down against
 * the dev app: grant an account a quota of 1, and see whether it is the first camp or the
 * second that gets refused. If the first, this becomes `<=`.
 */
const withinCampQuota =
  "size(auth.ref('$user.account.id')) != 0 && " +
  "size(auth.ref('$user.createdCamps.id')) < auth.ref('$user.account.campQuota')[0]"

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
      withinCampQuota,
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
      // The quota replaces the old `auth.id != null`: being signed in is no longer enough,
      // because signing in is something anyone can do unaided.
      create: 'isAdmin || withinCampQuota',
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
  pools: {
    bind: { isAdmin, isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isAdmin || isCampMember',
      create: 'isAdmin || isCampMember',
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
} satisfies InstantRules<AppSchema>

export default rules
