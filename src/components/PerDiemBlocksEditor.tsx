import { useState } from 'react'
import { type Dict, useFormat, useT } from '../i18n'
import {
  type BlockDraft,
  blankBlockDraft,
  blockDraftCents,
  blockDraftPersonDays,
  copyBlockDraft,
} from '../lib/drafts'
import { DateField } from './DateField'

type Props = {
  blocks: BlockDraft[]
  onChange: (blocks: BlockDraft[]) => void
}

/** "12 person-days", or an em dash while people/dates aren't usable yet. */
function personDaysText(personDays: number | null, t: Dict): string {
  if (personDays === null) return t.blocks.personDaysUnknown
  return t.blocks.personDays(personDays)
}

/**
 * The blocks of one per-diem source, each written as the sum it stands for:
 * `[12] people × [8,00] € per day`, then the dates, then what that comes to. The words
 * between the inputs do the work a stacked label above each one used to, which is what
 * keeps a block down to three lines; screen readers get the same words from `aria-label`.
 *
 * Owns no state except which blocks have their optional name field open — the form above
 * holds the drafts.
 */
export function PerDiemBlocksEditor({ blocks, onChange }: Props) {
  const t = useT()
  const format = useFormat()

  // Which rows have asked for the name field. A name is only ever needed to tell two
  // blocks apart, so with one block it stays behind a link until it is wanted.
  const [namedKeys, setNamedKeys] = useState<string[]>([])
  const solo = blocks.length === 1

  // Every update produces a NEW array. Mutating a row in place would leave React
  // comparing the same array reference to itself, see no change, and drop the keystroke.
  const patchRow = (key: string, fields: Partial<BlockDraft>) => {
    onChange(blocks.map((block) => (block.key === key ? { ...block, ...fields } : block)))
  }

  // A row's `key` is its React identity and exists from the moment you add it; its `id`
  // stays null until the card is saved and the hook mints one. Two different kinds of
  // identity — never use one for the other.
  const addRow = () => onChange([...blocks, blankBlockDraft(crypto.randomUUID())])

  const copyLastRow = () => {
    const last = blocks[blocks.length - 1]
    if (last === undefined) return
    onChange([...blocks, copyBlockDraft(last, crypto.randomUUID())])
  }

  const removeRow = (key: string) => onChange(blocks.filter((block) => block.key !== key))

  return (
    <div className="blocks">
      {blocks.length === 0 && <p className="blocks__empty">{t.blocks.empty}</p>}

      {blocks.map((block, index) => {
        const cents = blockDraftCents(block)
        // Two blocks always need telling apart, so the field appears by itself; a single
        // one that already carries a name keeps showing it.
        const showName = !solo || block.label !== '' || namedKeys.includes(block.key)
        return (
          <fieldset key={block.key} className={solo ? 'block block--solo' : 'block'}>
            {!solo && (
              <>
                <legend className="block__legend">{t.blocks.legend(index + 1)}</legend>
                <button
                  className="block__remove"
                  type="button"
                  onClick={() => removeRow(block.key)}
                  aria-label={t.blocks.remove(index + 1)}
                >
                  ✕
                </button>
              </>
            )}

            {showName ? (
              <input
                className="input block__name"
                aria-label={t.blocks.nameLabel}
                value={block.label}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  patchRow(block.key, { label: event.target.value })
                }
                placeholder={t.blocks.namePlaceholder}
              />
            ) : (
              <button
                className="block__name-add"
                type="button"
                onClick={() => setNamedKeys((keys) => [...keys, block.key])}
              >
                {t.blocks.nameAdd}
              </button>
            )}

            <p className="block__formula">
              <input
                className="input block__persons"
                type="number"
                min="1"
                step="1"
                aria-label={t.blocks.peopleLabel}
                value={block.persons}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  patchRow(block.key, { persons: event.target.value })
                }
                placeholder={t.blocks.peoplePlaceholder}
              />
              <span className="block__glue">{t.blocks.peopleGlue}</span>
              <input
                className="input block__rate"
                aria-label={t.blocks.rateLabel}
                aria-required="true"
                // inputMode="decimal" so a phone shows a numeric keypad. The value stays
                // a string here: cents happen in drafts.ts.
                inputMode="decimal"
                value={block.rate}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  patchRow(block.key, { rate: event.target.value })
                }
                placeholder={t.blocks.ratePlaceholder}
              />
              <span className="block__glue">{t.blocks.rateGlue}</span>
            </p>

            <DateField
              mode="range"
              ariaLabel={t.blocks.datesLabel}
              placeholder={t.blocks.datesPlaceholder}
              value={
                block.startDate !== '' && block.endDate !== ''
                  ? { start: block.startDate, end: block.endDate }
                  : null
              }
              onChange={({ start, end }) => patchRow(block.key, { startDate: start, endDate: end })}
            />

            <p className="block__summary">
              <span className="block__person-days">
                {personDaysText(blockDraftPersonDays(block), t)}
              </span>
              {/* An em dash while the row is incomplete: "0,00 €" would read as a real
                  (and wrong) amount. */}
              <strong>{cents === null ? '—' : format.euros(cents)}</strong>
            </p>
          </fieldset>
        )
      })}

      <div className="blocks__add-actions">
        <button className="blocks__add" type="button" onClick={addRow}>
          {t.blocks.add}
        </button>
        {blocks.length > 0 && (
          <button className="blocks__add" type="button" onClick={copyLastRow}>
            {t.blocks.copyLast}
          </button>
        )}
      </div>
    </div>
  )
}
