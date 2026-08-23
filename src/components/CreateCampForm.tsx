import { useState } from 'react'
import './CreateCampForm.css'
import { useT } from '../i18n'
import { Toast } from './Toast'

type Props = {
  error: string | null
  /** How many more camps this account may start. `null` is unlimited — the admin — and is
   *  why this is not a plain number: 0 would then have to mean both "none" and "no limit". */
  campsLeft: number | null
  onCreate: (name: string) => boolean
}

export function CreateCampForm({ error, campsLeft, onCreate }: Props) {
  const t = useT()
  // A *controlled input*: React state is the single source of truth for the value,
  // and every keystroke round-trips through setName. The DOM never holds state we
  // don't know about.
  const [name, setName] = useState('')

  const trimmed = name.trim()
  const usedUp = campsLeft !== null && campsLeft === 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault() // otherwise the browser navigates away on submit
    if (trimmed === '' || usedUp) return
    // Clear the field only on success; a rejected name stays put so it can be fixed.
    if (onCreate(trimmed)) setName('')
  }

  return (
    <form className="create-camp" onSubmit={handleSubmit}>
      <div className="create-camp__row">
        <input
          className="create-camp__input"
          type="text"
          value={name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          placeholder={t.camps.namePlaceholder}
          aria-label={t.camps.nameLabel}
          disabled={usedUp}
        />
        <button className="btn btn--primary" type="submit" disabled={usedUp || trimmed === ''}>
          {t.camps.create}
        </button>
      </div>
      {/* The allowance, only once it is worth mentioning: an admin has none, and a fresh
          grant with plenty left is noise on the busiest screen in the app. */}
      {usedUp && <p className="create-camp__quota">{t.access.usedUp}</p>}
      {campsLeft !== null && campsLeft > 0 && campsLeft <= 2 && (
        <p className="create-camp__quota">{t.access.left(campsLeft)}</p>
      )}
      {error !== null && <Toast key={error} message={error} />}
    </form>
  )
}
