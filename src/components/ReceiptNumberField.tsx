import { useId } from 'react'
import './ReceiptNumberField.css'
import { useT } from '../i18n'

type Props = {
  /** The number as typed — a string, because an empty field is a valid receipt. */
  value: string
  /** One past the highest number in the camp; a new receipt starts on it. */
  suggestion: number
  onChange: (value: string) => void
}

/**
 * The receipt-number field. A new receipt opens already carrying the next free number, so
 * the common case — filing slips in order — needs no tap; the hint under the field says
 * where that number came from, and it stays as editable as any other value.
 */
export function ReceiptNumberField({ value, suggestion, onChange }: Props) {
  const t = useT()
  const inputId = useId()
  const hintId = useId()
  // The hint only means something while the field still holds the offered number. Once it
  // is overwritten with a slip's own number, saying "next free" beside it would be a lie.
  const showsSuggestion = value === String(suggestion)

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {t.receipts.numberLabel}
      </label>
      <input
        className="income-form__input number-field__input"
        id={inputId}
        // A phone keypad, not a spinner: `type="number"` on a mobile browser brings tiny
        // steppers and accepts "1e3", neither of which helps here.
        inputMode="numeric"
        value={value}
        placeholder={t.receipts.numberPlaceholder}
        aria-describedby={showsSuggestion ? hintId : undefined}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
      {showsSuggestion && (
        <span className="number-field__hint" id={hintId}>
          {t.receipts.numberHint}
        </span>
      )}
    </div>
  )
}
