import { useMemo, useState } from 'react'
import './CampList.css'
import { useT } from '../i18n'
import { type CampWindow, campStatus, campWindow, sortCampsByRecent } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { Camp, PerDiemBlock } from '../lib/types'
import { CreateCampForm } from './CreateCampForm'
import { JoinCampForm } from './JoinCampForm'
import { StatusPill } from './StatusPill'

type CampCardProps = {
  camp: Camp
  /** This camp's date window, already derived by the list — null when nothing dates it
   *  yet. Not called `window`: inside the component that name is the browser global. */
  dateWindow: CampWindow | null
  todayIso: string
  onOpen: (campId: string) => void
}

/** One row in the list. Presentational: it takes data and callbacks, owns no state. */
export function CampCard({ camp, dateWindow, todayIso, onOpen }: CampCardProps) {
  return (
    <li className="camp-list__item">
      <button className="camp-card" type="button" onClick={() => onOpen(camp.id)}>
        <span className="camp-card__main">
          <span className="camp-card__name">{camp.name}</span>
          <span className="camp-card__code">{camp.joinCode}</span>
        </span>
        <StatusPill status={campStatus(dateWindow, todayIso)} />
      </button>
    </li>
  )
}

type Props = {
  camps: Camp[]
  /** Per-diem blocks of every listed camp, mixed together — what dates each of them. */
  blocks: PerDiemBlock[]
  /** Needed by the join form: a membership is always created for the user joining. */
  userId: string
  isLoading: boolean
  error: string | null
  onOpen: (campId: string) => void
  onCreate: (name: string) => boolean
  /** Gets the text of a chosen `.json` file; the parent parses and writes it. False means
   *  the file was refused, and the reason is in `error`. */
  onImport: (text: string) => boolean
}

export function CampList({
  camps,
  blocks,
  userId,
  isLoading,
  error,
  onOpen,
  onCreate,
  onImport,
}: Props) {
  const t = useT()
  const [importFailed, setImportFailed] = useState(false)
  // Reading the clock at the edge, then passing it down: `campStatus` stays pure.
  const today = todayIso()
  const ordered = sortCampsByRecent(camps)

  // One pass over the blocks instead of one filter per card, memoised so re-rendering the
  // list (typing a camp name, say) does not redo it. A Map because that is what a lookup
  // by id wants — plain objects would work, but this says "index", not "record".
  const windows = useMemo(() => {
    const byCamp = new Map<string, PerDiemBlock[]>()
    for (const block of blocks) {
      const existing = byCamp.get(block.campId)
      if (existing === undefined) byCamp.set(block.campId, [block])
      else existing.push(block)
    }
    return new Map(camps.map((camp) => [camp.id, campWindow(byCamp.get(camp.id) ?? [])]))
  }, [camps, blocks])

  const renderCamps = () => {
    // "No camps yet" and "we haven't heard back yet" are different sentences: the first
    // invites you to create one, the second would be a lie for a second or two.
    if (isLoading && camps.length === 0) {
      return <p className="camp-list__empty">{t.app.loading}</p>
    }
    if (ordered.length === 0) {
      return <p className="camp-list__empty">{t.camps.empty}</p>
    }
    return (
      <ul className="camp-list__items">
        {ordered.map((camp) => (
          <CampCard
            key={camp.id}
            camp={camp}
            dateWindow={windows.get(camp.id) ?? null}
            todayIso={today}
            onOpen={onOpen}
          />
        ))}
      </ul>
    )
  }

  // `<input type="file">` cannot be styled, so the real one is hidden inside a <label>:
  // clicking the label opens the picker, and the label is free to look like a button.
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file === undefined) return
    // Remembering *that* the import failed, not the message: the message is the shared
    // `error`, and this is only what decides to echo it down here, next to the button the
    // user just pressed, rather than at the top of the screen.
    setImportFailed(!onImport(await file.text()))
    // Clearing the value lets the same file be picked twice in a row — otherwise the
    // second pick fires no change event at all.
    event.target.value = ''
  }

  return (
    <div className="camp-list">
      <CreateCampForm error={error} onCreate={onCreate} />

      {renderCamps()}

      <JoinCampForm userId={userId} myCampIds={camps.map((camp) => camp.id)} />

      <section className="camp-list__import">
        <label className="camp-list__import-button">
          {t.camps.import}
          <input type="file" accept="application/json,.json" onChange={handleFile} />
        </label>
        <p className="camp-list__import-hint">{t.camps.importHint}</p>
        {importFailed && error !== null && (
          <p className="camp-list__import-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
