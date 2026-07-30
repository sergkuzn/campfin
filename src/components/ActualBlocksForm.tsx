import { useState } from 'react'
import { useFormat, useT } from '../i18n'
import {
  type BlockDraft,
  blockDraftCents,
  blockDraftsIssues,
  blockDraftsToInput,
  copyDraftsFromBlocks,
  draftsFromBlocks,
  type SaveBlocksInput,
} from '../lib/drafts'
import type { PerDiemBlock } from '../lib/types'
import { PerDiemBlocksEditor } from './PerDiemBlocksEditor'

type Props = {
  campId: string
  sourceId: string
  /** What the organisation funded — the rows "Copy from granted" duplicates. */
  grantedBlocks: PerDiemBlock[]
  /** The stored actual blocks; empty means none exist yet. */
  actualBlocks: PerDiemBlock[]
  /** True when the editor was opened by "Copy from granted": seed it with the copies. */
  seedFromGranted: boolean
  onSave: (input: SaveBlocksInput) => void
  onCancel: () => void
}

/**
 * Who really came: the same block editor as the grant, over the `actual` variant. It edits
 * blocks and nothing else — no name, no pool, no amount — so recording an early departure
 * can never disturb the grant it is compared against.
 */
export function ActualBlocksForm({
  campId,
  sourceId,
  grantedBlocks,
  actualBlocks,
  seedFromGranted,
  onSave,
  onCancel,
}: Props) {
  const t = useT()
  const format = useFormat()

  // The initialiser runs only on the first render, so re-seeding on every keystroke is
  // impossible; switching between sources re-mounts this form via its React key instead.
  const [blocks, setBlocks] = useState<BlockDraft[]>(() =>
    seedFromGranted
      ? copyDraftsFromBlocks(grantedBlocks, () => crypto.randomUUID())
      : draftsFromBlocks(actualBlocks),
  )

  const issues = blockDraftsIssues(blocks)
  const totalCents = blocks.reduce((sum, b) => sum + (blockDraftCents(b) ?? 0), 0)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input = blockDraftsToInput(blocks, campId, sourceId, 'actual')
    // null means a row is half typed; the check also narrows the type away.
    if (input === null) return
    onSave(input)
  }

  return (
    <form className="attendance__form" onSubmit={handleSubmit}>
      <p className="attendance__hint">{t.attendance.hint}</p>

      <PerDiemBlocksEditor blocks={blocks} onChange={setBlocks} />

      <div className="attendance__form-actions">
        <button
          className="attendance__button"
          type="button"
          onClick={() => setBlocks(copyDraftsFromBlocks(grantedBlocks, () => crypto.randomUUID()))}
        >
          {t.attendance.copyFromGranted}
        </button>
        {/* Clearing every row is how "everybody came after all" is saved: with no actual
            blocks, actual is granted again. */}
        <button className="attendance__button" type="button" onClick={() => setBlocks([])}>
          {t.attendance.reset}
        </button>
      </div>

      <p className="income__total-row">
        <span>{t.attendance.actual}</span>
        <strong>{format.euros(totalCents)}</strong>
      </p>

      {issues.length > 0 && (
        <ul className="card__issues">
          {issues.map((issue) => (
            <li key={issue}>{t.income.issues[issue]}</li>
          ))}
        </ul>
      )}

      <div className="card__actions">
        <button className="card__button" type="button" onClick={onCancel}>
          {t.attendance.cancel}
        </button>
        <button className="income-form__button" type="submit" disabled={issues.length > 0}>
          {t.attendance.save}
        </button>
      </div>
    </form>
  )
}
