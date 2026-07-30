import './CampList.css'
import { useT } from '../i18n'
import { campStatus, sortCampsByRecent } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { Camp } from '../lib/types'
import { CreateCampForm } from './CreateCampForm'
import { JoinCampForm } from './JoinCampForm'
import { StatusPill } from './StatusPill'

type CampCardProps = {
  camp: Camp
  todayIso: string
  onOpen: (campId: string) => void
}

/** One row in the list. Presentational: it takes data and callbacks, owns no state. */
export function CampCard({ camp, todayIso, onOpen }: CampCardProps) {
  return (
    <li className="camp-list__item">
      <button className="camp-card" type="button" onClick={() => onOpen(camp.id)}>
        <span className="camp-card__main">
          <span className="camp-card__name">{camp.name}</span>
          <span className="camp-card__code">{camp.joinCode}</span>
        </span>
        <StatusPill status={campStatus(camp, todayIso)} />
      </button>
    </li>
  )
}

type Props = {
  camps: Camp[]
  /** Needed by the join form: a membership is always created for the user joining. */
  userId: string
  isLoading: boolean
  error: string | null
  onOpen: (campId: string) => void
  onCreate: (name: string) => boolean
}

export function CampList({ camps, userId, isLoading, error, onOpen, onCreate }: Props) {
  const t = useT()
  // Reading the clock at the edge, then passing it down: `campStatus` stays pure.
  const today = todayIso()
  const ordered = sortCampsByRecent(camps)

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
          <CampCard key={camp.id} camp={camp} todayIso={today} onOpen={onOpen} />
        ))}
      </ul>
    )
  }

  return (
    <div className="camp-list">
      <CreateCampForm error={error} onCreate={onCreate} />

      {renderCamps()}

      <JoinCampForm userId={userId} myCampIds={camps.map((camp) => camp.id)} />
    </div>
  )
}
