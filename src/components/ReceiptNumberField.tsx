import { useId } from 'react'
import './ReceiptNumberField.css'
import { useT } from '../i18n'

type Props = {
  /** The number as typed — a string, because an empty field is a valid receipt. */
  value: string
  onChange: (value: string) => void
}

/**
 * The receipt-number field. A new receipt opens already carrying the next free number, so
 * the common case — filing slips in order — needs no tap, and the value stays as editable
 * as any other.
 */
export function ReceiptNumberField({ value, onChange }: Props) {
  const t = useT()
  const inputId = useId()

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
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </div>
  )
}
