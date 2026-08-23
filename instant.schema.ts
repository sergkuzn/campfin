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
  PoolColor,
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
      // The leader holding the camp's cash, by name. One field rather than a flag on each
      // payer, so "exactly one holder" cannot be broken by two phones promoting two people
      // while offline. Optional: nobody holds the money until somebody is named.
      moneyHolder: i.string().optional(),
      createdAt: i.number().indexed(),
      // No dates: a camp's window is the span of its per-diem blocks, derived on read.
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
      // A palette token, not a hex value — the stylesheet turns it into a colour that
      // works in both themes. Optional: pools created before colours existed have none.
      color: i.string<PoolColor>().optional(),
      createdAt: i.number(),
    }),

    incomeSources: i.entity({
      campId: i.string().indexed(),
      poolId: i.string().indexed(),
      kind: i.string<IncomeKind>().indexed(),
      // Optional: a pool's only income is named by the pool itself, so the deposit and
      // per-diem forms never ask for one. Only a second income in the same pool needs it.
      name: i.string().optional(),
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

    expenses: i.entity({
      campId: i.string().indexed(),
      poolId: i.string().indexed(),
      name: i.string(),
      amountCents: i.number(),
      date: i.string().indexed(),
      // The number written on the paper slip. Optional, and unique within a camp — the
      // uniqueness is enforced on the client, since it holds per camp rather than globally.
      number: i.number().optional().indexed(),
      note: i.string().optional(),
      // Whose wallet the money came from, as typed — free text rather than a link, so a
      // payer needs no namespace of its own, no permission rule and no id to remap on
      // import. Names are compared through `payerKey`, so case and spacing never split
      // one person in two.
      paidBy: i.string().optional(),
      // Whether the money holder has paid this person back. Absent/false = still owed. A
      // flag rather than a second row: the budget was consumed when the receipt was paid,
      // so booking the payback as a movement would spend the pool twice.
      reimbursed: i.boolean().optional(),
      enteredBy: i.string().optional(),
      createdAt: i.number(),
    }),

    movements: i.entity({
      campId: i.string().indexed(),
      // Present for the deposit kinds, absent for a participation fee — the union in
      // `src/lib/types.ts` is what makes that check compile-time on the client.
      poolId: i.string().optional().indexed(),
      kind: i.string<MovementKind>().indexed(),
      // Legacy: a handover once carried "this is the whole Kaution, even though it is less
      // than the deposit granted". Deposit steps now measure against the pool instead, and
      // nothing reads this. Kept so rows written before that still load; new writes null it.
      completesDeposit: i.boolean().optional(),
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
