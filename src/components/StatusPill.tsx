import './StatusPill.css'
import { type CampStatus, describeCampStatus } from '../lib/camps'

type Props = {
  status: CampStatus
}

export function StatusPill({ status }: Props) {
  // Template literal → "pill pill--running". The modifier class is what colours it.
  return <span className={`pill pill--${status}`}>{describeCampStatus(status)}</span>
}
