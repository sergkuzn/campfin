import { useMemo } from 'react'
import './IncomeSetup.css'
import type { UseIncome } from '../hooks/useIncome'
import { campSlice } from '../lib/income'
import { FixedGrantForm } from './FixedGrantForm'
import { PerDiemBlocksEditor } from './PerDiemBlocksEditor'
import { ReceivedTotals } from './ReceivedTotals'

type Props = {
  campId: string
  income: UseIncome
  onBack: () => void
}

/** The four ways money arrives, each as its own section, plus a live received total. */
export function IncomeSetup({ campId, income, onBack }: Props) {
  const { sources, blocks, contributions } = income

  // useMemo caches the filtered slice between renders and only recomputes when one of
  // the arrays changes identity — which, thanks to the immutable reducer, means "when
  // the data actually changed". Destructuring first keeps the dependency list honest.
  const slice = useMemo(
    () => campSlice({ sources, blocks, contributions }, campId),
    [sources, blocks, contributions, campId],
  )

  const perDiemSources = slice.sources.filter((s) => s.kind === 'per_diem')
  const gradualGrants = slice.sources.filter((s) => s.kind === 'fixed' && s.use === 'gradual')
  const reservedGrants = slice.sources.filter((s) => s.kind === 'fixed' && s.use === 'reserved')
  const passthroughSources = slice.sources.filter((s) => s.kind === 'passthrough')

  return (
    <div className="income">
      <button className="dashboard__back" type="button" onClick={onBack}>
        ← Back to camp
      </button>
      <h2 className="income__title">Set up income</h2>

      <section className="income__section">
        <h3 className="income__heading">Per-person daily money</h3>
        {perDiemSources.map((source) => (
          <PerDiemBlocksEditor
            key={source.id}
            source={source}
            blocks={slice.blocks.filter((b) => b.sourceId === source.id)}
            onAddBlock={income.addBlock}
            onDeleteBlock={income.deleteBlock}
            onDeleteSource={income.deleteSource}
          />
        ))}
        <button
          className="income__add"
          type="button"
          onClick={() => income.addPerDiemSource(campId, 'Verpflegungspauschale')}
        >
          ＋ Add per-diem group
        </button>
      </section>

      <section className="income__section">
        <h3 className="income__heading">A grant to spend freely</h3>
        <ul className="income__list">
          {gradualGrants.map((source) => (
            <li key={source.id} className="income__item">
              <span>{source.name}</span>
              <button type="button" onClick={() => income.deleteSource(source.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <FixedGrantForm
          placeholder="e.g. Extra food"
          buttonLabel="Add grant"
          onAdd={(name, cents) => income.addFixedGrant(campId, name, 'gradual', cents)}
        />
      </section>

      <section className="income__section">
        <h3 className="income__heading">Money set aside for one cause</h3>
        <ul className="income__list">
          {reservedGrants.map((source) => (
            <li key={source.id} className="income__item">
              <span>{source.name}</span>
              <button type="button" onClick={() => income.deleteSource(source.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <FixedGrantForm
          placeholder="e.g. Bike repair"
          buttonLabel="Add cause"
          onAdd={(name, cents) => income.addFixedGrant(campId, name, 'reserved', cents)}
        />
      </section>

      {/* Individual contributions get their own form in milestone 4; for now this just
          creates the bucket so its total has somewhere to land. */}
      <section className="income__section">
        <h3 className="income__heading">Money to pass on to the organisation</h3>
        <ul className="income__list">
          {passthroughSources.map((source) => (
            <li key={source.id} className="income__item">
              <span>{source.name}</span>
              <button type="button" onClick={() => income.deleteSource(source.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          className="income__add"
          type="button"
          onClick={() => income.addPassthroughSource(campId, 'Volunteer money → ijgd')}
        >
          ＋ Add pass-through bucket
        </button>
      </section>

      <footer className="income__totals">
        <ReceivedTotals
          sources={slice.sources}
          blocks={slice.blocks}
          contributions={slice.contributions}
        />
      </footer>
    </div>
  )
}
