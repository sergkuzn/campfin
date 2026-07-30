/**
 * Permission rules — the security boundary of this app. Pushed with `pnpm db:push`
 * alongside the schema. Rules run on Instant's servers, so they are the
 * only thing standing between a leader invited to camp A and the rows of camp B; the
 * client-side `campId` filters are convenience, never protection.
 *
 * Two ideas carry the whole file:
 *
 * 1. **Deny by default.** `$default` closes every namespace and every action that is not
 *    named below, and the `attrs` block stops clients from inventing new attributes —
 *    schema changes come from the CLI only.
 * 2. **Membership is the one authority.** Every camp-scoped row reaches its camp through
 *    its `camp` link, and the camp reaches its members through `members`. So
 *    `auth.id in data.ref('camp.members.user.id')` is the single question asked of a pool,
 *    a source, a block, a quittung and a movement alike.
 *
 * The exception is joining: a co-leader who has been given a join code is not a member yet,
 * so `camps.view` also accepts a caller who can *name* the code via `ruleParams`. That is
 * exactly the shape of the secret — knowing the code is the invitation.
 */

import type { InstantRules } from '@instantdb/react'
// Typing the rules against the schema means a namespace typo is a compile error rather
// than a rule that silently guards nothing.
import type { AppSchema } from './instant.schema'

const rules = {
  // Anything not named below is closed, for every action.
  $default: {
    allow: { $default: 'false' },
  },

  // No client may add or change attributes; the schema is pushed from `instant.schema.ts`.
  attrs: {
    allow: { $default: 'false' },
  },

  // A signed-in user sees their own $users row and nothing else — co-leaders' emails are
  // never readable, which is what keeps "no personal data" true of the cloud copy too.
  // `create` runs during the magic-code signup flow itself (not just `transact`), so it
  // has to stay open — anyone with a join code needs to be able to sign up.
  $users: {
    allow: {
      view: 'auth.id == data.id',
      create: 'true',
      update: 'false',
      delete: 'false',
    },
  },

  camps: {
    bind: {
      isMember: "auth.id in data.ref('members.user.id')",
      // `ruleParams.joinCode` is null unless the caller passes it, and joinCode is a
      // required string, so this is false for every query that doesn't name a code.
      knowsCode: 'data.joinCode == ruleParams.joinCode',
    },
    allow: {
      // Order matters: `||` short-circuits, so a member never reaches the join-code branch
      // and their own camps stay readable whatever a caller passes (or fails to pass) as a
      // rule param.
      view: 'isMember || knowsCode',
      // Not `isMember`: a brand-new camp has no members until the membership created in
      // the same transaction lands, and making the two rules depend on each other is a
      // good way to make camp creation unexplainably fail. A camp created without a
      // membership is invisible to everyone, including its creator — harmless, not a leak.
      create: 'auth.id != null',
      update: 'isMember',
      delete: 'isMember',
    },
  },

  memberships: {
    bind: {
      // The row links to $users, so this is "this membership is mine".
      isMine: "auth.id in data.ref('user.id')",
      isCampMember: "auth.id in data.ref('camp.members.user.id')",
    },
    allow: {
      // Members see who else is in the camp. The UI only ever counts them.
      view: 'isCampMember',
      // You may only ever add *yourself*: joining is done by the joiner, not by the
      // inviter. The camp's id — learned by presenting its join code — is the capability.
      create: 'isMine',
      // Role changes are not a feature yet; rotating admin means editing the row here.
      update: 'false',
      // Leaving a camp, and cleaning up when a camp is deleted.
      delete: 'isMine || isCampMember',
    },
  },

  // The five camp-scoped namespaces answer the same question, so they carry the same
  // block. Written out rather than generated: a permission file should be readable as
  // data, and `instant-cli push` reads the object, not the code that built it.
  pools: {
    bind: { isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isCampMember',
      create: 'isCampMember',
      update: 'isCampMember',
      delete: 'isCampMember',
    },
  },

  incomeSources: {
    bind: { isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isCampMember',
      create: 'isCampMember',
      update: 'isCampMember',
      delete: 'isCampMember',
    },
  },

  perDiemBlocks: {
    bind: { isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isCampMember',
      create: 'isCampMember',
      update: 'isCampMember',
      delete: 'isCampMember',
    },
  },

  expenses: {
    bind: { isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isCampMember',
      create: 'isCampMember',
      update: 'isCampMember',
      delete: 'isCampMember',
    },
  },

  movements: {
    bind: { isCampMember: "auth.id in data.ref('camp.members.user.id')" },
    allow: {
      view: 'isCampMember',
      create: 'isCampMember',
      update: 'isCampMember',
      delete: 'isCampMember',
    },
  },
} satisfies InstantRules<AppSchema>

export default rules
