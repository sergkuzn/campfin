import './BurnChart.css'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFormat, useT } from '../i18n'
import type { Burn, BurnPoint } from '../lib/burn'

type Props = {
  burn: Burn
  todayIso: string
}

/**
 * Cumulative allowance against cumulative spending, one point per camp day.
 *
 * `type="linear"` on purpose: a smoothed curve would invent values between days, and the
 * day *is* the unit of this data. The spending line stops at today (`actualCents` is
 * `null` afterwards, and `connectNulls={false}` respects that) rather than running flat
 * to the end of the camp, which would read as "we stopped spending".
 */
export function BurnChart({ burn, todayIso }: Props) {
  const t = useT()
  const format = useFormat()

  // Colour the spending line by the situation: over the allowance is the one state worth
  // spotting from across a room.
  const actualColor = burn.allowedTodayCents < 0 ? 'var(--danger)' : 'var(--ok)'
  const todayLabel = burn.points.find((p) => p.date === todayIso)?.dayLabel

  return (
    <div className="burn">
      <p className="burn__title">{t.burn.chartTitle}</p>

      {/* The SVG carries no text an assistive tech can make sense of, so the whole chart
          is announced as one image; the numbers above it say where the camp stands. */}
      <div className="burn__canvas" role="img" aria-label={t.burn.chartAlt(burn.points.length)}>
        {/* ResponsiveContainer measures its parent, so the chart has to be given a height
            in CSS or as a prop — an SVG has no intrinsic size to fall back on. */}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={burn.points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dayLabel"
              tickLine={false}
              stroke="var(--muted)"
              fontSize={11}
              // Long camps would crowd the axis; thinning labels keeps every *point*.
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickFormatter={format.eurosRounded}
              tickLine={false}
              axisLine={false}
              stroke="var(--muted)"
              fontSize={11}
              width={64}
            />
            <Tooltip
              formatter={(value) => (typeof value === 'number' ? format.euros(value) : '')}
              labelFormatter={(_label, payload) => {
                // Recharts hands back the whole row it drew, so the tooltip can show the
                // real date even though the axis only carries the day of the month.
                const point = payload?.[0]?.payload as BurnPoint | undefined
                return point === undefined ? '' : format.day(point.date)
              }}
              contentStyle={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.75rem',
              }}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: '0.75rem' }} />

            {todayLabel !== undefined && (
              <ReferenceLine x={todayLabel} stroke="var(--muted)" strokeDasharray="2 4" />
            )}

            <Line
              type="linear"
              dataKey="theoreticalCents"
              name={t.burn.theoretical}
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
            <Line
              type="linear"
              dataKey="actualCents"
              name={t.burn.actual}
              stroke={actualColor}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              // Without this a gap would be bridged, drawing spending we have not made.
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
