import { useState } from 'react'
import './AdminScreen.css'
import type { UseAdmin } from '../hooks/useAdmin'
import { useT } from '../i18n'
import { MAX_CAMP_QUOTA, type RosterEntry } from '../lib/accounts'
import { ConfirmDialog } from './ConfirmDialog'
import { SlotPanel } from './SlotCard'
import { Toast } from './Toast'

type Props = {
  admin: UseAdmin
  onBack: () => void
  onOpenCamp: (campId: string) => void
}

/**
 * Who may use this app, and everything in it. Only reachable from the admin's own camp
 * list, and only useful to an `admin` account — for anyone else the queries behind it come
 * back empty, because the permission rules, not this screen, are what hold the line.
 */
export function AdminScreen({ admin, onBack, onOpenCamp }: Props) {
  const t = useT()
  const { roster, camps, isLoading, error, grant, setQuota, revoke } = admin
  const [email, setEmail] = useState('')
  // Which grant is being revoked, if any. The entry itself rather than a boolean, so the
  // dialog can name the person it is about.
  const [revoking, setRevoking] = useState<RosterEntry | null>(null)

  const handleGrant = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Clear the field only on success; a rejected address stays put so it can be fixed.
    if (grant(email)) setEmail('')
  }

  const handleRevoke = () => {
    const account = revoking?.account
    if (account !== undefined && account !== null) revoke(account.id)
    setRevoking(null)
  }

  return (
    <div className="admin">
      <button className="screen-back" type="button" onClick={onBack}>
        {t.admin.back}
      </button>
      <h2 className="admin__title">{t.admin.title}</h2>

      <SlotPanel title={t.admin.peopleTitle}>
        <form className="admin__grant" onSubmit={handleGrant}>
          <input
            className="admin__input"
            type="email"
            value={email}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
            placeholder={t.admin.grantPlaceholder}
            aria-label={t.admin.grantLabel}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn btn--primary" type="submit" disabled={email.trim() === ''}>
            {t.admin.grant}
          </button>
        </form>

        {isLoading && roster.length === 0 ? (
          <p className="admin__empty">{t.app.loading}</p>
        ) : roster.length === 0 ? (
          <p className="admin__empty">{t.admin.peopleEmpty}</p>
        ) : (
          <ul className="admin__people">
            {roster.map((entry) => (
              <PersonRow
                // The address is the identity here: a person may have a user row, a grant,
                // or both, so neither id is present for every entry.
                key={entry.email}
                entry={entry}
                onGrant={() => grant(entry.email)}
                onQuota={(quota) => {
                  if (entry.account !== null) setQuota(entry.account.id, quota)
                }}
                onRevoke={() => setRevoking(entry)}
              />
            ))}
          </ul>
        )}
      </SlotPanel>

      <SlotPanel title={t.admin.campsTitle(camps.length)}>
        {camps.length === 0 ? (
          <p className="admin__empty">{t.admin.campsEmpty}</p>
        ) : (
          <ul className="admin__camps">
            {camps.map((camp) => (
              <li key={camp.id}>
                <button className="admin__camp" type="button" onClick={() => onOpenCamp(camp.id)}>
                  <span className="admin__camp-name">{camp.name}</span>
                  <span className="admin__camp-code">{camp.joinCode}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SlotPanel>

      {error !== null && <Toast key={error} message={error} />}

      <ConfirmDialog
        open={revoking !== null}
        title={t.admin.revokeTitle}
        lines={revoking === null ? [] : [t.admin.revokeConfirm(revoking.email)]}
        confirmLabel={t.admin.revoke}
        onConfirm={handleRevoke}
        onCancel={() => setRevoking(null)}
      />
    </div>
  )
}

type PersonRowProps = {
  entry: RosterEntry
  onGrant: () => void
  onQuota: (quota: number) => void
  onRevoke: () => void
}

/**
 * One person: their address, what they may do, and the controls that change it. Split out
 * because the three states — admin, activated leader, not activated — each want different
 * controls, and branching inside the list above would bury the list itself.
 */
function PersonRow({ entry, onGrant, onQuota, onRevoke }: PersonRowProps) {
  const t = useT()
  const { account } = entry

  return (
    <li className="admin__person">
      <div className="admin__person-main">
        <span className="admin__email">{entry.email}</span>
        {/* Two different absences: nobody has activated them, or nobody has signed in
            against the grant yet. Only the second is waiting on them rather than on you. */}
        {account === null ? (
          <span className="admin__state">{t.admin.notActivated}</span>
        ) : entry.userId === null ? (
          <span className="admin__state">{t.admin.pending}</span>
        ) : null}
      </div>

      {account === null ? (
        <button className="btn btn--ghost" type="button" onClick={onGrant}>
          {t.admin.grant}
        </button>
      ) : account.role === 'admin' ? (
        <span className="admin__state">{t.admin.adminBadge}</span>
      ) : (
        <div className="admin__controls">
          <button
            className="admin__step"
            type="button"
            aria-label={t.admin.quotaDown}
            disabled={account.campQuota <= 0}
            onClick={() => onQuota(account.campQuota - 1)}
          >
            −
          </button>
          <span className="admin__quota">{t.admin.quotaLabel(account.campQuota)}</span>
          <button
            className="admin__step"
            type="button"
            aria-label={t.admin.quotaUp}
            disabled={account.campQuota >= MAX_CAMP_QUOTA}
            onClick={() => onQuota(account.campQuota + 1)}
          >
            ＋
          </button>
          <button className="btn btn--danger" type="button" onClick={onRevoke}>
            {t.admin.revoke}
          </button>
        </div>
      )}
    </li>
  )
}
