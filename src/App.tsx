import { formatEuros, perDiemBudgetCents } from './lib/budget'

// A throwaway example so the scaffold shows something real end-to-end:
// typed config -> pure budget function -> money formatted at the display edge.
// Milestone 1 replaces this with the actual data model + screens.
const EXAMPLE = {
  ratePerPersonDayCents: 1250, // €12.50 / person / day, stored as integer cents
  numParticipants: 10,
  numLeaders: 2,
  numDays: 14,
  leaderLeadDays: 1,
} as const

export default function App() {
  const budgetCents = perDiemBudgetCents(EXAMPLE)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">campfin</h1>
        <p className="text-sm text-neutral-500">Camp budget tracker — scaffold is alive ✅</p>
      </header>

      <section className="w-full rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Example per-diem budget
        </p>
        <p className="mt-1 font-semibold text-4xl tabular-nums">{formatEuros(budgetCents)}</p>
        <p className="mt-3 text-xs text-neutral-500">
          {EXAMPLE.numParticipants} participants · {EXAMPLE.numLeaders} leaders · {EXAMPLE.numDays}{' '}
          days · {formatEuros(EXAMPLE.ratePerPersonDayCents)}/person/day
        </p>
      </section>

      <p className="text-xs text-neutral-400">Next: milestone 1 — data model &amp; budget math.</p>
    </main>
  )
}
