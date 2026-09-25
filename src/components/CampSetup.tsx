import { useState } from 'react'
import './CampSetup.css'
import { useFormat, useT } from '../i18n'
import { type PoolSummary, receivedTotalCents } from '../lib/pools'

type Props = {
  /** The name stored on the camp. Undefined, or blank, while nobody holds the money. */
  holder: string | undefined
  /** Whether any pool has income. Computed by the parent from the same summaries. */
  funded: boolean
  /** This camp's pools, read only for the received total on the finished income step. */
  summaries: PoolSummary[]
  onSaveHolder: (name: string) => void
  onOpenIncome: () => void
}

/**
 * The two things a camp needs before it can track anything: someone holding the money,
 * and money to hold. Shown in place of the dashboard until both are answered.
 *
 * Both steps stay on screen once done, ticked, so the list says how far along you are
 * rather than swapping one instruction for another. The holder is typed here rather than
 * in settings — it is one string, and a detour through another screen for it is longer
 * than the task.
 */
export function CampSetup({ holder, funded, summaries, onSaveHolder, onOpenIncome }: Props) {
  const t = useT()
  const format = useFormat()

  // Same rule the gate applies: a name of spaces names nobody, so it counts as unanswered
  // rather than drawing an empty sentence.
  const holderName = holder?.trim() ?? ''
  const holderDone = holderName !== ''

  // UI mode, not data: the saved name says who holds the money, never whether the field
  // is open. Without a name there is nothing to show instead, so the field stays open
  // however this flag was left — including after a write that never landed.
  const [changing, setChanging] = useState(false)
  const [name, setName] = useState('')

  const editing = changing || !holderDone
  const trimmed = name.trim()

  const submitHolder = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trimmed === '') return
    onSaveHolder(trimmed)
    setName('')
    setChanging(false)
  }

  return (
    <section className="camp-setup">
      <h3 className="camp-setup__title">{t.setup.title}</h3>
      <p className="camp-setup__hint">{t.setup.hint}</p>

      {/* An ordered list, because the order is the point: the holder is what every "owed"
          marker is measured against, so it comes first. */}
      <ol className="camp-setup__steps">
        <Step index={1} title={t.setup.holderStep} done={holderDone}>
          {editing ? (
            <>
              {/* Same sentence the ⓘ shows in camp settings, but always on here — this is
                  the field's first appearance, so the explanation earns its place without
                  needing a tap. */}
              <p className="camp-setup__step-info">{t.campSettings.holderInfo}</p>
              <form className="camp-setup__row" onSubmit={submitHolder}>
                <input
                  className="camp-setup__input"
                  aria-label={t.campSettings.holderNewNameLabel}
                  type="text"
                  value={name}
                  placeholder={t.campSettings.holderNewNamePlaceholder}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setName(event.target.value)
                  }
                />
                <button className="btn btn--primary" type="submit" disabled={trimmed === ''}>
                  {t.campSettings.holderSave}
                </button>
                {holderDone && (
                  <button
                    className="btn btn--ghost"
                    type="button"
                    onClick={() => {
                      setChanging(false)
                      setName('')
                    }}
                  >
                    {t.campSettings.holderCancel}
                  </button>
                )}
              </form>
            </>
          ) : (
            <>
              <p className="camp-setup__readout">
                <strong className="camp-setup__holder-name">{holderName}</strong>{' '}
                {t.campSettings.holderHolds}
              </p>
              <button
                className="btn btn--ghost camp-setup__ghost--end"
                type="button"
                onClick={() => setChanging(true)}
              >
                {t.campSettings.holderChange}
              </button>
            </>
          )}
        </Step>

        <Step index={2} title={t.setup.incomeStep} done={funded}>
          {funded ? (
            <p className="camp-setup__readout">
              {t.dashboard.receivedTotal}{' '}
              <strong>{format.euros(receivedTotalCents(summaries))}</strong>
            </p>
          ) : (
            <p className="camp-setup__readout">{t.setup.incomeTodo}</p>
          )}
          {/* The step still to do carries a full-width call to action; once it is done the
              same button drops to a ghost, so the list reads as a queue rather than as two
              equal options. */}
          <button
            className={funded ? 'btn btn--ghost' : 'btn btn--primary btn--block'}
            type="button"
            onClick={onOpenIncome}
          >
            {funded ? t.setup.incomeEdit : t.setup.incomeGo}
          </button>
        </Step>
      </ol>
    </section>
  )
}

/** One numbered row: its marker turns into a tick once the step is answered. */
function Step({
  index,
  title,
  done,
  children,
}: {
  index: number
  title: string
  done: boolean
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <li className={done ? 'camp-setup__step camp-setup__step--done' : 'camp-setup__step'}>
      <span className="camp-setup__marker" aria-hidden="true">
        {done ? '✓' : index}
      </span>
      <div className="camp-setup__body">
        <p className="camp-setup__step-title">
          {title}
          {/* The tick is decoration a screen reader cannot read; this is the same fact
              in words, next to the step it belongs to. */}
          {done && <span className="visually-hidden"> {t.setup.done}</span>}
        </p>
        {children}
      </div>
    </li>
  )
}
