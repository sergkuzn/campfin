import { useEffect, useRef, useState } from 'react'
import './DateField.css'
import { useBackDismiss } from '../hooks/useBackDismiss'
import { useFormat, useT } from '../i18n'
import { type CampWindow, windowLabel } from '../lib/camps'
import { isWithin } from '../lib/dates'
import { Calendar } from './Calendar'
import { ConfirmDialog } from './ConfirmDialog'

type SingleProps = {
  mode: 'single'
  value: string
  onChange: (iso: string) => void
  /** The camp's span: highlighted on the grid, and days outside it get a confirm-first
   *  warning instead of an instant pick. Absent when nothing dates the camp yet, or the
   *  field isn't camp-scoped at all. */
  campWindow?: CampWindow
}

type RangeProps = {
  mode: 'range'
  value: { start: string; end: string } | null
  onChange: (range: { start: string; end: string }) => void
  placeholder: string
}

type Props = (SingleProps | RangeProps) & {
  id?: string
}

function labelFor(props: Props, formatDay: (iso: string) => string): string {
  if (props.mode === 'single') return props.value === '' ? '' : formatDay(props.value)
  if (props.value === null) return props.placeholder
  return windowLabel({ startIso: props.value.start, endIso: props.value.end }, formatDay)
}

/**
 * The popover date picker that replaces `<input type="date">`: a button showing the
 * chosen day(s), opening a `Calendar` panel on click. In single mode with an
 * `allowedRange`, picking a day outside it opens a confirm dialog instead of committing
 * straight away — the "are you sure?" the receipt date needed without blocking the pick.
 */
export function DateField(props: Props) {
  const t = useT()
  const format = useFormat()
  const [open, setOpen] = useState(false)
  const [pendingOutside, setPendingOutside] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = () => setOpen(false)
  useBackDismiss(open, close)

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const commitSingle = (iso: string) => {
    if (props.mode !== 'single') return
    const { campWindow } = props
    if (campWindow !== undefined && !isWithin(iso, campWindow.startIso, campWindow.endIso)) {
      setPendingOutside(iso)
      return
    }
    props.onChange(iso)
    setOpen(false)
  }

  const confirmOutside = () => {
    if (props.mode === 'single' && pendingOutside !== null) props.onChange(pendingOutside)
    setPendingOutside(null)
    setOpen(false)
  }

  return (
    <div className="date-field" ref={containerRef}>
      <button
        id={props.id}
        type="button"
        className="date-field__trigger"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {labelFor(props, format.day) || ' '}
      </button>

      {open && (
        <div className="date-field__panel">
          {props.mode === 'single' ? (
            <Calendar
              mode="single"
              value={props.value}
              campWindow={props.campWindow}
              onSelect={commitSingle}
            />
          ) : (
            <Calendar
              mode="range"
              value={props.value}
              onSelect={(range) => {
                props.onChange(range)
                setOpen(false)
              }}
            />
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingOutside !== null}
        title={t.calendar.outsideRangeTitle}
        lines={[t.calendar.outsideRangeLine]}
        confirmLabel={t.calendar.outsideRangeConfirm}
        onConfirm={confirmOutside}
        onCancel={() => setPendingOutside(null)}
      />
    </div>
  )
}
