import './StatusPill.css'
import { useT } from '../i18n'
import type { CampStatus } from '../lib/camps'

type Props = {
  status: CampStatus
}

export function StatusPill({ status }: Props) {
  const t = useT()
  // Indexing the dictionary by the status: adding a fourth CampStatus without a label
  // is a compile error, which is what a `describeCampStatus` switch used to buy.
  // Template literal → "pill pill--running". The modifier class is what colours it.
  return <span className={`pill pill--${status}`}>{t.camps.status[status]}</span>
}
