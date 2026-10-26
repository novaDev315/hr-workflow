import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type DepartmentDatum = { name: string; value: number; detail?: string }

const BAR_COLOR = 'hsl(15 54% 52%)'
const INK_MUTED = 'hsl(32 9% 38%)'
const INK = 'hsl(36 7% 8%)'
const TICK_FONT_SIZE = 13
// Rough average glyph width for the UI font at 13px; used to size the axis and clip long names.
const TICK_CHAR_WIDTH = 7.6
const AXIS_MAX_WIDTH = 180
// recharts places the tick ~8px left of the plot; keep that gap plus a small inset inside the axis width.
const AXIS_PADDING = 20

// One-line category label: never wraps, long names are clipped with an ellipsis and keep a native tooltip.
function CategoryTick(props: { x?: number | string; y?: number | string; payload?: { value?: unknown }; width?: number }) {
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const name = String(props.payload?.value ?? '')
  const maxChars = Math.max(4, Math.floor((AXIS_MAX_WIDTH - AXIS_PADDING) / TICK_CHAR_WIDTH))
  const label = name.length > maxChars ? `${name.slice(0, maxChars - 1).trimEnd()}…` : name
  return (
    <text x={x} y={y} textAnchor="end" dominantBaseline="central" fill={INK_MUTED} fontSize={TICK_FONT_SIZE}>
      <title>{name}</title>
      {label}
    </text>
  )
}

/**
 * Single-series horizontal bar chart (one hue, values labeled at the bar end)
 * with an equivalent table for screen readers.
 */
export function DepartmentBarChart({
  data,
  valueLabel,
  formatValue,
  caption,
}: {
  data: DepartmentDatum[]
  valueLabel: string
  formatValue: (value: number) => string
  caption: string
}) {
  const height = Math.max(120, data.length * 40 + 16)
  const longestName = data.reduce((max, datum) => Math.max(max, datum.name.length), 0)
  const axisWidth = Math.min(AXIS_MAX_WIDTH, Math.max(72, Math.ceil(longestName * TICK_CHAR_WIDTH) + AXIS_PADDING))
  const longestLabel = data.reduce((max, datum) => Math.max(max, formatValue(datum.value).length), 0)
  const labelRoom = Math.max(32, Math.ceil(longestLabel * 7.6) + 12)

  return (
    <figure className="min-w-0">
      <div
        aria-hidden="true"
        className="min-w-0"
        style={{ height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: labelRoom, bottom: 4, left: 0 }}
            barCategoryGap={10}
          >
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="name"
              width={axisWidth}
              tickLine={false}
              axisLine={false}
              tick={<CategoryTick />}
            />
            <Tooltip
              cursor={{ fill: 'hsl(40 18% 94% / 0.7)' }}
              formatter={(value: number) => [formatValue(value), valueLabel]}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid hsl(38 14% 86%)',
                boxShadow: '0 8px 24px rgba(60,42,30,0.08)',
                fontSize: 13,
                color: INK,
              }}
              labelStyle={{ fontWeight: 600, color: INK }}
            />
            <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} maxBarSize={22}>
              <LabelList
                dataKey="value"
                content={(props) => {
                  const x = Number(props.x ?? 0)
                  const y = Number(props.y ?? 0)
                  const width = Number(props.width ?? 0)
                  const barHeight = Number(props.height ?? 0)
                  return (
                    <text
                      x={x + width + 8}
                      y={y + barHeight / 2}
                      dominantBaseline="central"
                      fill={INK}
                      fontSize={13}
                      fontWeight={600}
                    >
                      {formatValue(Number(props.value ?? 0))}
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Department</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.name}>
              <th scope="row">{datum.name}</th>
              <td>
                {formatValue(datum.value)}
                {datum.detail ? ` (${datum.detail})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
