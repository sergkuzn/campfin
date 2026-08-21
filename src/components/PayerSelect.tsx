import { useState } from 'react'
import { useT } from '../i18n'
import { isSamePayer } from '../lib/payers'

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
      <legend className="field__label">{t.receipts.payer.label}</legend>

      {moneyHolder === undefined ? (
        <p className="field__hint">{t.receipts.payer.noHolder}</p>
      ) : (
        <label className="field field--check">
          <input type="radio" name="paidBy" checked={isHolder} onChange={pickHolder} />
          <span className="field__check-label">{t.receipts.payer.holderOption(moneyHolder)}</span>
        </label>
      )}

      <label className="field field--check">
        <input type="radio" name="paidBy" checked={isOther} onChange={pickOther} />
        <span className="field__check-label">{t.receipts.payer.otherOption}</span>
      </label>

      {isOther && (
        <>
          <label className="field payer__name">
            <span className="field__label">{t.receipts.payer.newNameLabel}</span>
            <input
              className="income-form__input"
              value={value}
              placeholder={t.receipts.payer.newNamePlaceholder}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onChange(event.target.value)
              }
            />
          </label>

          {/* Only once there is somebody who *could* be owed. A receipt can be typed in
              days after the cash was already handed over, so the editor has to be able to
              say "this one is already settled" without a trip through the list — but the
              holder can never owe themselves, whichever radio put their name in the box. */}
          {trimmed !== '' && !namesHolder && (
            <label className="field field--check">
              <input
                type="checkbox"
                checked={reimbursed}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  onReimbursedChange(event.target.checked)
                }
              />
              <span>
                <span className="field__check-label">{t.receipts.payer.returnedLabel}</span>
                <span className="field__hint">{t.receipts.payer.returnedHint}</span>
              </span>
            </label>
          )}
        </>
      )}
    </fieldset>
  )
}
