import { useState } from 'react'
import './ViewLinkCard.css'
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'
import { useFormat, useT } from '../i18n'
import type { CampWindow } from '../lib/camps'
import { endsBeforeCamp, type ViewAccess, viewLink } from '../lib/viewAccess'
import { ConfirmDialog } from './ConfirmDialog'
import { DateField } from './DateField'

type Props = {
  access: ViewAccess
  /** The camp's span. Its last day is where a new link ends by default, and `null` — no
   *  per-diem income yet — leaves nothing to end it on. */
  campWindow: CampWindow | null
  /** Issue a fresh link open through this day. After turning a link off, this is what makes
   *  a new one — with a new code, so the old link stays dead. */
  onOpen: (lastDayIso: string) => void
  /** Move the end of the current link, keeping its code. */
  onSetUntil: (lastDayIso: string) => void
  onClose: () => void
}

/**
 * The participants' read-only link: create it, copy it, move its end or turn it off. The end defaults to the camp's last day, which is what makes access lapse on its
 * own once the camp is over — the server checks the date, so nobody has to remember to.
 */
export function ViewLinkCard({ access, campWindow, onOpen, onSetUntil, onClose }: Props) {
  const t = useT()
  const format = useFormat()
  const [copyState, copy] = useCopyToClipboard()
  const [confirmingClose, setConfirmingClose] = useState(false)

  if (access.state === 'off') {
    return (
      <div className="view-link">
        {campWindow === null && <p className="view-link__hint">{t.viewLink.needsDates}</p>}
        <button
          className="btn btn--primary"
          type="button"
          disabled={campWindow === null}
          onClick={() => {
            if (campWindow !== null) onOpen(campWindow.endIso)
          }}
        >
          {t.viewLink.create}
        </button>
      </div>
    )
  }

  // Built on whatever address this app is served from, so a dev build hands out dev links
  // and a production build production ones.
  const link = viewLink(window.location.origin, access.code)
  // Only when the camp is dated: an undated camp has no end the link could fall short of.
  const behind =
    campWindow !== null && endsBeforeCamp(access.lastDayIso, campWindow.endIso)
      ? campWindow.endIso
      : null

  return (
    <div className="view-link">
      <button className="view-link__button" type="button" onClick={() => copy(link)}>
        <span className="view-link__url">{link}</span>
        {/* aria-live so the swap to "Copied" is announced, not just seen. */}
        <span className="view-link__action" aria-live="polite">
          {copyState === 'copied' ? t.viewLink.copied : t.viewLink.copy}
        </span>
      </button>
      {copyState === 'failed' && (
        <p className="view-link__error" role="alert">
          {t.viewLink.copyFailed}
        </p>
      )}

      <p
        className={
          access.state === 'open'
            ? 'view-link__status'
            : 'view-link__status view-link__status--closed'
        }
      >
        {access.state === 'open'
          ? t.viewLink.openUntil(format.day(access.lastDayIso))
          : t.viewLink.closedSince(format.day(access.lastDayIso))}
      </p>

      {behind !== null && (
        <p className="view-link__behind">
          {t.viewLink.behindCamp(format.day(behind))}{' '}
          <button className="btn btn--ghost" type="button" onClick={() => onSetUntil(behind)}>
            {t.viewLink.extend(format.day(behind))}
          </button>
        </p>
      )}

      <div className="view-link__until">
        <label className="view-link__label" htmlFor="view-link-until">
          {t.viewLink.lastDayLabel}
        </label>
        {/* No `campWindow` here: that would ask "outside the camp dates — sure?" about a day
            after the camp, and a few days' grace past the end is exactly what this is for. */}
        <DateField
          id="view-link-until"
          mode="single"
          value={access.lastDayIso}
          onChange={onSetUntil}
        />
        {/* The only way to shut a link early. There is no "replace": turning it off and
            creating a fresh one does the same, and one button cannot be mistaken for two. */}
        <button
          className="btn btn--ghost view-link__close"
          type="button"
          onClick={() => setConfirmingClose(true)}
        >
          {t.viewLink.close}
        </button>
      </div>

      <ConfirmDialog
        open={confirmingClose}
        title={t.viewLink.closeTitle}
        lines={[t.viewLink.closeLine]}
        confirmLabel={t.viewLink.closeConfirm}
        onConfirm={() => {
          setConfirmingClose(false)
          onClose()
        }}
        onCancel={() => setConfirmingClose(false)}
      />
    </div>
  )
}
