import { useState } from 'react'
import './CreateCampForm.css'

type Props = {
  error: string | null
  onCreate: (name: string) => boolean
}

export function CreateCampForm({ error, onCreate }: Props) {
  // A *controlled input*: React state is the single source of truth for the value,
  // and every keystroke round-trips through setName. The DOM never holds state we
  // don't know about.
  const [name, setName] = useState('')

  const trimmed = name.trim()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault() // otherwise the browser navigates away on submit
    if (trimmed === '') return
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
          placeholder="New camp name…"
          aria-label="New camp name"
        />
        <button className="create-camp__button" type="submit" disabled={trimmed === ''}>
          Create
        </button>
      </div>
      {error !== null && (
        <p className="create-camp__error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
