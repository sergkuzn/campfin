import { useState } from 'react'
import { formatEuros, perDiemBudgetCents } from '../lib/budget'
import { dayCount } from '../lib/dates'
import { parseEurosToCents } from '../lib/money'
import type { PerDiemBlock, PerDiemSource } from '../lib/types'

export type Props = {
  source: PerDiemSource
  blocks: PerDiemBlock[] // already filtered to this source
  onAddBlock: (block: Omit<PerDiemBlock, 'id'>) => void
  onDeleteBlock: (blockId: string) => void
  onDeleteSource: (sourceId: string) => void
}

/**
 * One per-diem source and its blocks: "N people, from–to, at €X per person per day".
 * Every euro figure comes from `perDiemBudgetCents` rather than being re-derived here —
 * the people × rate × days rule lives in `budget.ts`, tested, in exactly one place.
 */
export function PerDiemBlocksEditor({
  source,
  blocks,
  onAddBlock,
  onDeleteBlock,
  onDeleteSource,
}: Props) {
  // One piece of state per field, all held as strings: that is what an <input> gives
  // us, and keeping the raw text lets a half-typed "12," stay on screen while invalid.
  const [label, setLabel] = useState('')
  const [persons, setPersons] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [rate, setRate] = useState('')

  // Parsed values, derived on each render. `numPersons` is NaN while the field is empty.
  const numPersons = Number(persons)
  const ratePerPersonDayCents = parseEurosToCents(rate)
  // ISO dates compare correctly as plain strings — lexicographic order is chronological.
  const datesOk = startDate !== '' && endDate !== '' && startDate <= endDate
  const valid =
    Number.isInteger(numPersons) &&
    numPersons > 0 &&
    datesOk &&
    ratePerPersonDayCents !== null &&
    ratePerPersonDayCents > 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || ratePerPersonDayCents === null) return // re-check narrows away the null
    onAddBlock({
      campId: source.campId,
      sourceId: source.id,
      label: label.trim() || undefined, // an omitted optional field is undefined, not ''
      numPersons,
      ratePerPersonDayCents,
      startDate,
      endDate,
    })
    setLabel('')
    setPersons('')
    setStartDate('')
    setEndDate('')
    setRate('')
  }

  return (
    <article className="per-diem">
      <header className="per-diem__header">
        <h4 className="per-diem__name">{source.name}</h4>
        <button
          className="per-diem__remove"
          type="button"
          onClick={() => onDeleteSource(source.id)}
          aria-label={`Delete ${source.name}`}
        >
          ✕
        </button>
      </header>

      {blocks.length === 0 ? (
        <p className="per-diem__empty">No blocks yet — add one below.</p>
      ) : (
        <ul className="per-diem__blocks">
          {blocks.map((block) => (
            <li key={block.id} className="per-diem__block">
              <div className="per-diem__block-desc">
                <span className="per-diem__block-label">{block.label ?? 'Block'}</span>
                <span className="per-diem__block-meta">
                  {block.numPersons} people · {block.startDate} – {block.endDate} (
                  {dayCount(block.startDate, block.endDate)} days) ·{' '}
                  {formatEuros(block.ratePerPersonDayCents)}/day
                </span>
              </div>
              {/* A single-element array reuses the same summing function as the total. */}
              <span className="per-diem__block-sum">
                {formatEuros(perDiemBudgetCents([block]))}
              </span>
              <button
                className="per-diem__remove"
                type="button"
                onClick={() => onDeleteBlock(block.id)}
                aria-label="Delete block"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="income-form per-diem__form" onSubmit={handleSubmit}>
        <input
          className="income-form__input"
          value={label}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setLabel(event.target.value)}
          placeholder="e.g. Participants"
          aria-label="Block label"
        />
        <input
          className="income-form__input income-form__input--persons"
          type="number"
          min="1"
          step="1"
          value={persons}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPersons(event.target.value)}
          placeholder="People"
          aria-label="Number of people"
        />
        <input
          className="income-form__input income-form__input--date"
          type="date"
          value={startDate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setStartDate(event.target.value)
          }
          aria-label="Start date"
        />
        <input
          className="income-form__input income-form__input--date"
          type="date"
          value={endDate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEndDate(event.target.value)}
          aria-label="End date"
        />
        <input
          className="income-form__input income-form__input--amount"
          inputMode="decimal"
          value={rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRate(event.target.value)}
          placeholder="€ per person/day"
          aria-label="Rate per person per day in euros"
        />
        <button className="income-form__button" type="submit" disabled={!valid}>
          Add block
        </button>
      </form>

      <p className="per-diem__total">
        Source total <strong>{formatEuros(perDiemBudgetCents(blocks))}</strong>
      </p>
    </article>
  )
}
