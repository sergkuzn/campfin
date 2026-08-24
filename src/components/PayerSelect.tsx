import { useState } from 'react'
import { useT } from '../i18n'
import { isSamePayer } from '../lib/payers'
import { RequiredMark } from './RequiredMark'

type Props = {
  /** The name on the draft, as typed. Empty means nothing has been picked yet. */
  value: string
  /** Who holds the camp cash, named in camp settings. Undefined until one is. */
  moneyHolder: string | undefined
  /** Whether the payer has already been paid back. Only asked when somebody else paid. */
  reimbursed: boolean
  onChange: (name: string) => void
  onReimbursedChange: (reimbursed: boolean) => void
}

/**
 * Who paid for this receipt, and — when that was not the money holder — whether they have
 * been paid back yet.
 *
 * Two radios rather than a dropdown of everyone seen before: in practice there are two
 * answers, "out of the camp cash" and "somebody fronted it", and a list of past names made
 * the common answer as much work as the rare one. **Neither is selected to begin with**, so
 * whose money it was is a decision rather than a default that gets saved unnoticed.
 *
 * The component holds no draft of its own — it renders the value it is given and reports
 * changes upward, so the same markup serves a new receipt and an edited one.
 */
export function PayerSelect({
  value,
  moneyHolder,
  reimbursed,
  onChange,
  onReimbursedChange,
}: Props) {
  const t = useT()

  const trimmed = value.trim()
  const namesHolder = isSamePayer(value, moneyHolder)
  // "Someone else, name not typed yet" and "nothing picked" are both an empty field, and
  // only the user knows which they meant — so that one bit is the component's own state.
  // Everything else is derived, which is what keeps an edited receipt selecting the right
  // radio with no effect to synchronise it.
  const [otherPicked, setOtherPicked] = useState(false)
  // The "paid back" explanation costs a line only when asked for, by whoever taps the ⓘ.
  const [showReturnedHint, setShowReturnedHint] = useState(false)

  // An explicit pick of "someone else" wins over what the name happens to say, so typing
  // the holder's own name into that box cannot leave both radios lit at once.
  const isOther = otherPicked || (trimmed !== '' && !namesHolder)
  const isHolder = !otherPicked && namesHolder

  const pickHolder = () => {
    setOtherPicked(false)
    onChange(moneyHolder ?? '')
  }

  const pickOther = () => {
    setOtherPicked(true)
    // Cleared rather than kept: the holder's name left in the box would be a name the user
    // has just said is the wrong one.
    if (namesHolder) onChange('')
  }

  return (
    <fieldset className="payer">
      <legend className="field__label">
        {t.receipts.payer.label}
        <RequiredMark />
      </legend>

      {moneyHolder === undefined ? (
        <p className="field__hint">{t.receipts.payer.noHolder}</p>
      ) : (
        <label className="field field--check">
          <input type="radio" name="paidBy" checked={isHolder} onChange={pickHolder} />
          <span className="field__check-label">{t.receipts.payer.holderOption(moneyHolder)}</span>
        </label>
      )}

      {/* The radio, the name field, and (once there is a name to owe) the "paid back"
          checkbox all read as one answer, so they share a row rather than a line each. The
          radio carries no visible text — the name field beside it already says what
          choosing it means. */}
      <div className="payer__other">
        <input
          type="radio"
          name="paidBy"
          aria-label={t.receipts.payer.otherOption}
          checked={isOther}
          onChange={pickOther}
        />
        <input
          className="input payer__other-name"
          aria-label={t.receipts.payer.newNameLabel}
          // Blank while the holder is selected: `paidBy` carries their name in that case,
          // and echoing it here would read as a second, different person.
          value={isOther ? value : ''}
          placeholder={t.receipts.payer.newNamePlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        />

        {/* Only once there is somebody who *could* be owed. A receipt can be typed in days
            after the cash was already handed over, so the editor has to be able to say "this
            one is already settled" without a trip through the list — but the holder can
            never owe themselves, whichever radio put their name in the box. */}
        {isOther && trimmed !== '' && !namesHolder && (
          <>
            <label className="payer__returned">
              <input
                type="checkbox"
                checked={reimbursed}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  onReimbursedChange(event.target.checked)
                }
              />
              <span className="field__check-label">{t.receipts.payer.returnedLabel}</span>
            </label>
            <button
              type="button"
              className="info-button"
              aria-expanded={showReturnedHint}
              aria-label={t.receipts.payer.returnedInfoLabel}
              onClick={() => setShowReturnedHint((shown) => !shown)}
            >
              ⓘ
            </button>
          </>
        )}
      </div>

      {isOther && trimmed !== '' && !namesHolder && showReturnedHint && (
        <p className="field__hint">{t.receipts.payer.returnedHint}</p>
      )}
    </fieldset>
  )
}
