import { useState } from 'react'
import { parseEurosToCents } from '../lib/money'

type Props = {
  placeholder: string
  buttonLabel: string
  onAdd: (name: string, amountCents: number) => void
}

/**
 * Name + euro amount, used for both a freely-spendable grant and an earmarked cause;
 * only the labels and the `onAdd` callback differ.
 */
export function FixedGrantForm({ placeholder, buttonLabel, onAdd }: Props) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  // Derived on every render rather than stored: cents is a pure function of the input.
  const cents = parseEurosToCents(amount) // number | null — null while the field is invalid
  const valid = name.trim() !== '' && cents !== null && cents > 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // `valid` covers this at runtime, but TypeScript treats the two expressions as
    // unrelated; re-checking here is what narrows `number | null` down to `number`.
    if (!valid || cents === null) return
    onAdd(name.trim(), cents)
    setName('')
    setAmount('')
  }

  return (
    <form className="income-form" onSubmit={handleSubmit}>
      <input
        className="income-form__input"
        value={name}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <input
        className="income-form__input income-form__input--amount"
        inputMode="decimal"
        value={amount}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
        placeholder="€ amount"
        aria-label="Amount in euros"
      />
      <button className="income-form__button" type="submit" disabled={!valid}>
        {buttonLabel}
      </button>
    </form>
  )
}
