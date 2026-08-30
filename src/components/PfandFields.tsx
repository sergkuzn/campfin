import './ReceiptsScreen.css'
import { useFormat, useT } from '../i18n'
import { PfandIcon } from './PfandIcon'

type Props = {
  /** Whether the block is open. Closed means the receipt has no pfand at all. */
  open: boolean
  /** True when the amount above is the whole receipt total, deposit folded inside it. */
  inTotal: boolean
  paid: string
  returned: string
  /** What the receipt would book against its pool, or null while the numbers above are
   *  unreadable — then the readout is left off rather than showing a figure that is wrong. */
  groupCents: number | null
  onToggle: (open: boolean) => void
  onChange: (fields: { inTotal?: boolean; paid?: string; returned?: string }) => void
}

/**
 * The deposit on a receipt: two amounts and the question of which number went into
 * the amount box above.
 *
 * Folded away behind one button, because nearly every receipt carries none — a
 * form that asked about them every time would charge the common case for the rare one.
 * Open, it costs three rows, and the live "group money spent" readout at the bottom is
 * what makes the two modes tell themselves apart: it is the number that lands in the pool,
 * and watching it move as the radio flips is quicker than reading either label.
 *
 * Holds no draft of its own — it renders what it is given and reports changes upward, so
 * the same markup serves a new receipt and an edited one.
 */
export function PfandFields({
  open,
  inTotal,
  paid,
  returned,
  groupCents,
  onToggle,
  onChange,
}: Props) {
  const t = useT()
  const format = useFormat()

  if (!open) {
    return (
      <button
        className="btn btn--ghost pfand-fields__add"
        type="button"
        onClick={() => onToggle(true)}
        aria-label={t.receipts.pfand.addLabel}
      >
        {t.receipts.pfand.add}
        <PfandIcon className="pfand-icon--tall" />
      </button>
    )
  }

  return (
    <fieldset className="pfand-fields">
      {/* A direct child of the <fieldset>, which is what makes it the group's accessible
          name — wrapped in a layout div it would be a styled heading and nothing more. */}
      <legend className="field__label pfand-fields__legend">{t.receipts.pfand.legend}</legend>

      {/* Closing the block clears the deposit whatever is still typed in the boxes, so
          undoing a pfand added by mistake is one tap rather than two fields to empty. */}
      <button
        className="pfand-fields__remove"
        type="button"
        onClick={() => onToggle(false)}
        aria-label={t.receipts.pfand.remove}
      >
        ✕
      </button>

      {/* A nested <fieldset> would be the semantic fit, but nesting one inside another
          reads poorly in screen readers; `radiogroup` says the same thing flatly. */}
      <div className="pfand-fields__mode" role="radiogroup" aria-label={t.receipts.pfand.modeLabel}>
        <span className="field__label" aria-hidden="true">
          {t.receipts.pfand.modeLabel}
        </span>
        <label className="field field--check">
          <input
            type="radio"
            name="pfand-mode"
            checked={inTotal}
            onChange={() => onChange({ inTotal: true })}
          />
          <span className="field__check-label">{t.receipts.pfand.modeInTotal}</span>
        </label>
        <label className="field field--check">
          <input
            type="radio"
            name="pfand-mode"
            checked={!inTotal}
            onChange={() => onChange({ inTotal: false })}
          />
          <span className="field__check-label">{t.receipts.pfand.modeOnTop}</span>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">{t.receipts.pfand.paidLabel}</span>
          <input
            className="input input--amount"
            inputMode="decimal"
            value={paid}
            placeholder={t.receipts.pfand.amountPlaceholder}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ paid: event.target.value })
            }
          />
        </label>

        <label className="field">
          <span className="field__label">{t.receipts.pfand.returnedLabel}</span>
          <input
            className="input input--amount"
            inputMode="decimal"
            value={returned}
            placeholder={t.receipts.pfand.amountPlaceholder}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ returned: event.target.value })
            }
          />
        </label>
      </div>

      {groupCents !== null && (
        <p className="pfand-fields__readout">
          {t.receipts.pfand.groupLine(format.euros(groupCents))}
        </p>
      )}
    </fieldset>
  )
}
