import './Custody.css'
import { useFormat, useT } from '../i18n'
import { type DepositStatus, type DepositStep, depositSteps } from '../lib/movements'

type Props = {
  /** One reading per deposit pool, computed once by the parent. */
  statuses: DepositStatus[]
}

/**
 * Where each deposit currently sits. None of these figures is budget — a Kaution is
 * somebody else's money passing through your hands, which is why it gets a strip of its own
 * rather than a spent/left bar.
 */
export function DepositsStrip({ statuses }: Props) {
  const t = useT()

  if (statuses.length === 0) {
    return <p className="slot-card__hint">{t.custody.deposits.empty}</p>
  }

  return (
    <div className="custody">
      {statuses.map((status) => (
        <DepositRow key={status.pool.id} status={status} />
      ))}
    </div>
  )
}

/** The glyph in front of a step. Decorative — the label and amount carry the meaning. */
const STEP_MARK: Record<DepositStep['state'], string> = {
  todo: '○',
  partial: '◑',
  done: '✓',
  over: '!',
}

function DepositRow({ status }: { status: DepositStatus }) {
  const t = useT()
  const format = useFormat()

  // A deposit is a two-step errand — hand it over, get it back — so the strip shows it as a
  // checklist rather than as a sentence about where the money currently is.
  const steps = depositSteps(status)

  return (
    <div className="custody__row">
      <div className="custody__head">
        <span className="custody__name">{status.pool.name}</span>
        <span className="custody__amount">{format.euros(status.fundedCents)}</span>
      </div>

      <StepLine
        step={steps.out}
        label={t.custody.deposits.stepOut}
        excess={t.custody.deposits.stepOverOut}
      />

      {/* Only worth a line when it happened: a Kaution the counterparty kept is the one
          part of a deposit that never comes back. */}
      {status.forfeitedCents > 0 && (
        <p className="custody__line custody__line--kept">
          {t.custody.deposits.forfeited(format.euros(status.forfeitedCents))}
        </p>
      )}

      <StepLine
        step={steps.back}
        label={t.custody.deposits.stepBack}
        excess={t.custody.deposits.stepOverBack}
      />
    </div>
  )
}

type StepLineProps = {
  step: DepositStep
  label: string
  /** Names the surplus when more money moved than the step expected. */
  excess: (amount: string) => string
}

function StepLine({ step, label, excess }: StepLineProps) {
  const t = useT()
  const format = useFormat()

  return (
    <>
      <p className={`custody__step custody__step--${step.state}`}>
        <span aria-hidden="true" className="custody__tick">
          {STEP_MARK[step.state]}
        </span>
        <span className="custody__step-label">{label}</span>
        <span className="custody__step-amount">
          {t.custody.deposits.stepAmount(
            format.euros(step.doneCents),
            format.euros(step.targetCents),
          )}
        </span>
      </p>

      {step.state === 'over' && (
        <p className="custody__line custody__line--odd">
          {excess(format.euros(step.doneCents - step.targetCents))}
        </p>
      )}
    </>
  )
}
