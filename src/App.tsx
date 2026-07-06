import './App.css'
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
    <main className="app">
      <header>
        <h1 className="app__title">campfin</h1>
        <p className="app__subtitle">Camp budget tracker — scaffold is alive ✅</p>
      </header>

      <section className="card">
        <p className="card__label">Example per-diem budget</p>
        <p className="card__amount">{formatEuros(budgetCents)}</p>
        <p className="card__meta">
          {EXAMPLE.numParticipants} participants · {EXAMPLE.numLeaders} leaders · {EXAMPLE.numDays}{' '}
          days · {formatEuros(EXAMPLE.ratePerPersonDayCents)}/person/day
        </p>
      </section>

      <p className="app__next">Next: milestone 1 — data model &amp; budget math.</p>
    </main>
  )
}
