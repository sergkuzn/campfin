import { useMemo } from 'react'
import './CampList.css'
import type { CampAccess } from '../hooks/useAccount'
import { useT } from '../i18n'
import { type CampWindow, campStatus, campWindow, sortCampsByRecent } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { Camp, PerDiemBlock } from '../lib/types'
import { CreateCampForm } from './CreateCampForm'
import { JoinCampForm } from './JoinCampForm'
import { Screen } from './Screen'
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
  /** What this account may start. Decides whether the create form appears at all. */
  access: CampAccess
  /** Admin only: whether the list is currently showing every camp in the database. */
  showAllCamps: boolean
  isLoading: boolean
  error: string | null
  onOpen: (campId: string) => void
  onCreate: (name: string) => boolean
  onToggleAllCamps: (showAll: boolean) => void
  onOpenAdmin: () => void
}

export function CampList({
  camps,
  blocks,
  userId,
  access,
  showAllCamps,
  isLoading,
  error,
  onOpen,
  onCreate,
  onToggleAllCamps,
  onOpenAdmin,
}: Props) {
  const t = useT()
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

  return (
    <Screen name="camp-list">
      {access.isAdmin && (
        <div className="camp-list__admin">
          <button className="camp-list__admin-link" type="button" onClick={onOpenAdmin}>
            {t.admin.open}
          </button>
          <label className="camp-list__admin-toggle">
            <input
              type="checkbox"
              checked={showAllCamps}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onToggleAllCamps(event.target.checked)
              }
            />
            {t.admin.showAllCamps}
          </label>
        </div>
      )}

      {/* No grant, no create form. The join form below stays either way: being invited to
          somebody else's camp is not something this app's owner has to approve. */}
      {access.account === null ? (
        <section className="camp-list__locked">
          <h2 className="camp-list__locked-title">{t.access.lockedTitle}</h2>
          <p className="camp-list__locked-body">{t.access.lockedBody}</p>
        </section>
      ) : (
        <CreateCampForm error={error} campsLeft={access.campsLeft} onCreate={onCreate} />
      )}

      {renderCamps()}

      <JoinCampForm userId={userId} myCampIds={camps.map((camp) => camp.id)} />
    </Screen>
  )
}
