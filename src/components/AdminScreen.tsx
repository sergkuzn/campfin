import { useState } from 'react'
import './AdminScreen.css'
import type { UseAdmin } from '../hooks/useAdmin'
import { type Dict, useT } from '../i18n'
import type { CampMembers } from '../lib/access'
import { MAX_CAMP_QUOTA, type RosterEntry } from '../lib/accounts'
import type { Camp } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { RowMenu, type RowMenuItem } from './RowMenu'
import { Screen } from './Screen'
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
  const { roster, waiting, camps, access, isLoading, error, grant, setQuota, revoke } = admin
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
    <Screen name="admin" back={{ label: t.admin.back, onClick: onBack }}>
      <h2 className="screen__title">{t.admin.title}</h2>

      {/* A to-do list, deliberately duplicating rows from the register below. These people
          also appear there with their full controls; up here they get one button, so the
          panel reads as "what is waiting on you" rather than as a second roster. Hidden
          entirely when nothing is queued, so an empty state never competes for the top of
          the screen. */}
      {waiting.length > 0 && (
        <SlotPanel title={t.admin.waitingTitle(waiting.length)}>
          <p className="admin__waiting-body">{t.admin.waitingBody}</p>
          <ul className="admin__people">
            {waiting.map((entry) => (
              <li className="admin__person" key={entry.email}>
                <span className="admin__email">{entry.email}</span>
                <button
                  className="btn btn--primary admin__waiting-grant"
                  type="button"
                  onClick={() => grant(entry.email)}
                >
                  {t.admin.grant}
                </button>
              </li>
            ))}
          </ul>
        </SlotPanel>
      )}

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
                campsIn={access.byEmail.get(entry.email) ?? []}
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
                  <span className="admin__camp-main">
                    <span className="admin__camp-name">{camp.name}</span>
                    {memberLines(access.byCamp.get(camp.id), t).map((line) => (
                      <span className="admin__members" key={line}>
                        {line}
                      </span>
                    ))}
                  </span>
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
    </Screen>
  )
}

/**
 * Who can open a camp: one address per line, plus any member the roster cannot name. One
 * line each rather than a comma-joined string, because two addresses never fit across a
 * phone and the second would be cut off by the ellipsis.
 */
function memberLines(members: CampMembers | undefined, t: Dict): string[] {
  const lines = members === undefined ? [] : [...members.emails]
  if (members !== undefined && members.unknownCount > 0) {
    lines.push(t.admin.unknownMembers(members.unknownCount))
  }
  return lines.length === 0 ? [t.admin.campMembersEmpty] : lines
}

type PersonRowProps = {
  entry: RosterEntry
  /** The camps this address is a member of — empty for a grant nobody has used yet. */
  campsIn: Camp[]
  onGrant: () => void
  onQuota: (quota: number) => void
  onRevoke: () => void
}

/**
 * One person: their address, what they may do, and the controls that change it. Split out
 * because the three states — admin, activated leader, not activated — each want different
 * controls, and branching inside the list above would bury the list itself.
 *
 * Everything readable is a line under the address; everything actionable is behind the ⋮,
 * as on the receipt and pool rows. Spelled out as buttons, four controls were wider than
 * an email address, which is the one thing this row exists to show.
 */
function PersonRow({ entry, campsIn, onGrant, onQuota, onRevoke }: PersonRowProps) {
  const t = useT()
  const { account } = entry

  // The bounds decide whether a step is *offered* at all: the menu has no disabled state,
  // and a choice that would do nothing is better left off it.
  const items: RowMenuItem[] =
    account === null
      ? [{ label: t.admin.grant, onSelect: onGrant }]
      : account.role === 'admin'
        ? [] // The admin's own row: no quota to meter, and no revoking yourself.
        : [
            ...(account.campQuota < MAX_CAMP_QUOTA
              ? [{ label: t.admin.quotaUp, onSelect: () => onQuota(account.campQuota + 1) }]
              : []),
            ...(account.campQuota > 0
              ? [{ label: t.admin.quotaDown, onSelect: () => onQuota(account.campQuota - 1) }]
              : []),
            { label: t.admin.revoke, danger: true, onSelect: onRevoke },
          ]

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
        {account !== null && (
          <span className="admin__state">
            {account.role === 'admin' ? t.admin.adminBadge : t.admin.quotaLabel(account.campQuota)}
          </span>
        )}
        {/* Which camps they can open — memberships, not the grant: joining by code needs no
            grant at all, so this is the only honest answer to "what can they see?".
            Skipped for an address that has never signed in, since it can have no
            memberships and the line above already says why. */}
        {entry.userId !== null &&
          (campsIn.length === 0 ? (
            <span className="admin__state">{t.admin.inNoCamps}</span>
          ) : (
            campsIn.map((camp) => (
              <span className="admin__state" key={camp.id}>
                {camp.name}
              </span>
            ))
          ))}
      </div>

      {/* The admin's own row has nothing to choose, so it gets no trigger to open. */}
      {items.length > 0 && <RowMenu label={entry.email} disabled={false} items={items} />}
    </li>
  )
}
