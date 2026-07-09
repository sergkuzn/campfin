import './CampList.css'
import { campStatus, sortCampsByRecent } from '../lib/camps'
import { todayIso } from '../lib/dates'
import type { Camp } from '../lib/types'
import { CreateCampForm } from './CreateCampForm'
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
          <span className="camp-card__code">{camp.id}</span>
        </span>
        <StatusPill status={campStatus(camp, todayIso)} />
      </button>
    </li>
  )
}

type Props = {
  camps: Camp[]
  error: string | null
  onOpen: (campId: string) => void
  onCreate: (name: string) => boolean
}

export function CampList({ camps, error, onOpen, onCreate }: Props) {
  // Reading the clock at the edge, then passing it down: `campStatus` stays pure.
  const today = todayIso()
  const ordered = sortCampsByRecent(camps)

  return (
    <div className="camp-list">
      <CreateCampForm error={error} onCreate={onCreate} />

      {ordered.length === 0 ? (
        <p className="camp-list__empty">No camps yet. Create one above.</p>
      ) : (
        <ul className="camp-list__items">
          {ordered.map((camp) => (
            <CampCard key={camp.id} camp={camp} todayIso={today} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </div>
  )
}
