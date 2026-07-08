import './App.css'
import { formatEuros, perDiemBudgetCents } from './lib/budget'
import { dayCount } from './lib/dates'
import type { PerDiemBlock } from './lib/types'

// Placeholder data until the Setup screen exists: participants for the camp
// proper, leaders arriving a day early and leaving a day late.
const EXAMPLE_BLOCKS: PerDiemBlock[] = [
  {
    id: 'b1',
    campId: 'demo',
    sourceId: 'pd',
    label: 'participants',
    numPersons: 10,
    ratePerPersonDayCents: 1200,
    startDate: '2026-07-01',
    endDate: '2026-07-14',
  },
  {
    id: 'b2',
    campId: 'demo',
    sourceId: 'pd',
    label: 'leaders',
    numPersons: 2,
    ratePerPersonDayCents: 1200,
    startDate: '2026-06-30',
    endDate: '2026-07-15',
  },
]

export default function App() {
  const budgetCents = perDiemBudgetCents(EXAMPLE_BLOCKS)

  return (
    <main className="app">
      <header>
        <h1 className="app__title">campfin</h1>
        <p className="app__subtitle">Camp budget tracker — scaffold is alive ✅</p>
      </header>

      <section className="card">
        <p className="card__label">Example per-diem budget</p>
        <p className="card__amount">{formatEuros(budgetCents)}</p>
        <ul className="card__meta">
          {EXAMPLE_BLOCKS.map((block) => (
            <li key={block.id}>
              {block.numPersons} {block.label} · {dayCount(block.startDate, block.endDate)} days ·{' '}
              {formatEuros(block.ratePerPersonDayCents)}/person/day
            </li>
          ))}
        </ul>
      </section>

      <p className="app__next">Next: milestone 2 — setup screen &amp; dashboard.</p>
    </main>
  )
}
