import { useId } from 'react'
import './ReceiptNumberField.css'
import { useT } from '../i18n'

type Props = {
  /** The number as typed — a string, because an empty field is a valid receipt. */
  value: string
  /** One past the highest number in the camp; the button fills it in. */
  suggestion: number
  onChange: (value: string) => void
}

/**
 * The receipt-number field, shared by the full form and the quick-add dialog so both offer
 * the same next number. The button exists because the alternative is remembering where the
 * paper folder got to, which is exactly what the number is for.
 */
export function ReceiptNumberField({ value, suggestion, onChange }: Props) {
  const t = useT()
  // The button must sit outside the <label> — a label wrapping a button steals its taps —
  // so the input is tied to its text by id instead.
  const inputId = useId()

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {t.receipts.numberLabel}
      </label>
      <div className="number-field">
        <input
          className="income-form__input number-field__input"
          id={inputId}
          // A phone keypad, not a spinner: `type="number"` on a mobile browser brings tiny
          // steppers and accepts "1e3", neither of which helps here.
          inputMode="numeric"
          value={value}
          placeholder={t.receipts.numberPlaceholder}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        />
        <button
          className="number-field__suggest"
          type="button"
          onClick={() => onChange(String(suggestion))}
        >
          {t.receipts.numberSuggest(suggestion)}
        </button>
      </div>
    </div>
  )
}
