import { formatEuros } from '../lib/budget'
import {
  type BlockDraft,
  blankBlockDraft,
  blockDraftCents,
  blockDraftPersonDays,
} from '../lib/drafts'

type Props = {
  blocks: BlockDraft[]
  onChange: (blocks: BlockDraft[]) => void
}

/** "12 person-days", or an em dash while people/dates aren't usable yet. */
function personDaysText(personDays: number | null): string {
  if (personDays === null) return '— person-days'
  return `${personDays} person-day${personDays === 1 ? '' : 's'}`
}

/**
 * The blocks of one per-diem source as editable mini-cards: name, people, dates and
 * rate each behind their own label, with a live person-day count and subtotal.
 * Owns no state — the form above holds the drafts.
 */
export function PerDiemBlocksEditor({ blocks, onChange }: Props) {
  // Every update produces a NEW array. Mutating a row in place would leave React
  // comparing the same array reference to itself, see no change, and drop the keystroke.
  const patchRow = (key: string, fields: Partial<BlockDraft>) => {
    onChange(blocks.map((block) => (block.key === key ? { ...block, ...fields } : block)))
  }

  // A row's `key` is its React identity and exists from the moment you add it; its `id`
  // stays null until the card is saved and the hook mints one. Two different kinds of
  // identity — never use one for the other.
  const addRow = () => onChange([...blocks, blankBlockDraft(crypto.randomUUID())])

  const removeRow = (key: string) => onChange(blocks.filter((block) => block.key !== key))

  return (
    <div className="blocks">
      {blocks.length === 0 && <p className="blocks__empty">No blocks yet — add one below.</p>}

      {blocks.map((block, index) => {
        const cents = blockDraftCents(block)
        return (
          <fieldset key={block.key} className="block">
            <legend className="block__legend">Block {index + 1}</legend>

            <button
              className="block__remove"
              type="button"
              onClick={() => removeRow(block.key)}
              aria-label={`Remove block ${index + 1}`}
            >
              ✕
            </button>

            <label className="field">
              <span className="field__label">Block name</span>
              <input
                className="income-form__input"
                value={block.label}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  patchRow(block.key, { label: event.target.value })
                }
                placeholder="e.g. Participants"
              />
            </label>

            <div className="block__row">
              <label className="field">
                <span className="field__label">Number of people</span>
                <input
                  className="income-form__input"
                  type="number"
                  min="1"
                  step="1"
                  value={block.persons}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    patchRow(block.key, { persons: event.target.value })
                  }
                  placeholder="e.g. 24"
                />
              </label>

              <label className="field">
                <span className="field__label">Rate per person / day</span>
                <input
                  className="income-form__input"
                  // inputMode="decimal" so a phone shows a numeric keypad. The value stays
                  // a string here: cents happen in drafts.ts.
                  inputMode="decimal"
                  value={block.rate}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    patchRow(block.key, { rate: event.target.value })
                  }
                  placeholder="€ e.g. 12,50"
                />
              </label>
            </div>

            <div className="block__row">
              <label className="field">
                <span className="field__label">Start date</span>
                <input
                  className="income-form__input"
                  type="date"
                  value={block.startDate}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    patchRow(block.key, { startDate: event.target.value })
                  }
                />
              </label>

              <label className="field">
                <span className="field__label">End date</span>
                <input
                  className="income-form__input"
                  type="date"
                  value={block.endDate}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    patchRow(block.key, { endDate: event.target.value })
                  }
                />
              </label>
            </div>

            <p className="block__summary">
              <span className="block__person-days">
                {personDaysText(blockDraftPersonDays(block))}
              </span>
              {/* An em dash while the row is incomplete: "0,00 €" would read as a real
                  (and wrong) amount. */}
              <strong>{cents === null ? '—' : formatEuros(cents)}</strong>
            </p>
          </fieldset>
        )
      })}

      <button className="blocks__add" type="button" onClick={addRow}>
        ＋ Add block
      </button>
    </div>
  )
}
