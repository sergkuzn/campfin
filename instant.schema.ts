/**
 * The InstantDB schema — the shape of the cloud copy. Pushed with `pnpm db:push`
 * (`pnpm dlx instant-cli@latest push`) and handed to `init`, so queries and transactions
 * are typed against the same definition the server enforces.
 *
 * Two things every camp-scoped row carries, and both are deliberate:
 *
 * - **`campId`, a plain indexed string.** Every filter and every function in `src/lib/`
 *   works off it, which is why the pure math needed no changes to move onto a database.
 * - **a `camp` link.** Permission rules can only traverse *links*, never fields, so
 *   membership checks (`data.ref('camp.members.user.id')`) need the link to exist. It
 *   also gives cascade deletes for free: `onDelete: 'cascade'` on the row's side means
 *   deleting a camp deletes its rows server-side, instead of the client having to walk
 *   six namespaces and hope it finishes.
 *
 * `src/db/` is the only writer and always writes both.
 */

import { i } from '@instantdb/react'
import type {
  IncomeKind,
  MemberRole,
  MovementKind,
  PerDiemVariant,
  PoolRole,
} from './src/lib/types'

// `i.string<Union>()` keeps the union type on the attribute, so a typo in a role or a
// variant is a compile error in a transaction rather than a bad row in the database.
const _schema = i.schema({
  entities: {
    // $users is managed by Instant's auth; declaring it here only types the email.
    $users: i.entity({
      email: i.string().unique().indexed(),
    }),

    camps: i.entity({
      name: i.string(),
      // The human-typable code a co-leader enters to join. Unique so two camps can never
      // answer the same code; indexed because the join screen queries by it.
      joinCode: i.string().unique().indexed(),
      createdAt: i.number().indexed(),
      startDate: i.string().optional(),
      endDate: i.string().optional(),
    }),

    // Who may touch a camp. No names, no emails — a user id and a role (golden rule 3).
    memberships: i.entity({
      campId: i.string().indexed(),
      userId: i.string().indexed(),
      role: i.string<MemberRole>().indexed(),
      createdAt: i.number(),
    }),

    pools: i.entity({
      campId: i.string().indexed(),
      name: i.string(),
      role: i.string<PoolRole>().indexed(),
      createdAt: i.number(),
    }),

    incomeSources: i.entity({
      campId: i.string().indexed(),
      poolId: i.string().indexed(),
      kind: i.string<IncomeKind>().indexed(),
      name: i.string(),
      // Optional because a per-diem source has no stored amount at all — it is computed
      // from its blocks. The row mapper enforces "present for fixed and deposit".
      amountCents: i.number().optional(),
      createdAt: i.number(),
    }),

    perDiemBlocks: i.entity({
      campId: i.string().indexed(),
      sourceId: i.string().indexed(),
      variant: i.string<PerDiemVariant>().indexed(),
      label: i.string().optional(),
      numPersons: i.number(),
      ratePerPersonDayCents: i.number(),
      startDate: i.string(),
      endDate: i.string(),
    }),

    // Declared now, read and written from stage 08 / 11. Pushing the whole schema once is
    // cheaper than pushing it twice, and the permission rules below already cover them.
    expenses: i.entity({
      campId: i.string().indexed(),
      poolId: i.string().indexed(),
      name: i.string(),
      amountCents: i.number(),
      date: i.string().indexed(),
      note: i.string().optional(),
      enteredBy: i.string().optional(),
      createdAt: i.number(),
    }),

    movements: i.entity({
      campId: i.string().indexed(),
      // Present for the deposit kinds, absent for volunteer money — the union in
      // `src/lib/types.ts` is what makes that check compile-time on the client.
      poolId: i.string().optional().indexed(),
      kind: i.string<MovementKind>().indexed(),
      name: i.string(),
      amountCents: i.number(),
      date: i.string().indexed(),
      note: i.string().optional(),
      createdAt: i.number(),
    }),
  },

  links: {
    // `onDelete: 'cascade'` sits on the row's side of each link: deleting the camp on the
    // other end takes the row with it.
    membershipCamp: {
      forward: { on: 'memberships', has: 'one', label: 'camp', onDelete: 'cascade' },
      reverse: { on: 'camps', has: 'many', label: 'members' },
    },
    membershipUser: {
      forward: { on: 'memberships', has: 'one', label: 'user', onDelete: 'cascade' },
      reverse: { on: '$users', has: 'many', label: 'memberships' },
    },
    poolCamp: {
      forward: { on: 'pools', has: 'one', label: 'camp', onDelete: 'cascade' },
      reverse: { on: 'camps', has: 'many', label: 'pools' },
    },
    incomeSourceCamp: {
      forward: { on: 'incomeSources', has: 'one', label: 'camp', onDelete: 'cascade' },
      reverse: { on: 'camps', has: 'many', label: 'incomeSources' },
    },
    perDiemBlockCamp: {
      forward: { on: 'perDiemBlocks', has: 'one', label: 'camp', onDelete: 'cascade' },
      reverse: { on: 'camps', has: 'many', label: 'perDiemBlocks' },
    },
    expenseCamp: {
      forward: { on: 'expenses', has: 'one', label: 'camp', onDelete: 'cascade' },
      reverse: { on: 'camps', has: 'many', label: 'expenses' },
    },
    movementCamp: {
      forward: { on: 'movements', has: 'one', label: 'camp', onDelete: 'cascade' },
      reverse: { on: 'camps', has: 'many', label: 'movements' },
    },
  },
})

// Assigning through an interface is Instant's recommended shape: it stops TypeScript from
// inlining a huge structural type into every hint and error message.
type _AppSchema = typeof _schema
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema

export type { AppSchema }
export default schema
