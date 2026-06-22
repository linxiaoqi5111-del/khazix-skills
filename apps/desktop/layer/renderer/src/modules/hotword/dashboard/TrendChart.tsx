/**
 * SVG-based trend line chart for hotword frequency over time.
 * Renders sparkline-style mini charts or a larger detailed view.
 */

import type { TermTimeSeries } from "@follow/hotword"
import { useMemo } from "react"

const CHART_COLORS = [
  "#E63946", // red (primary brand)
  "#FF6B6B", // coral
  "#4ECDC4", // teal
  "#45B7D1", // sky blue
  "#96CEB4", // sage
  "#FFEAA7", // pale yellow
  "#DDA0DD", // plum
  "#98D8C8", // mint
]

interface TrendChartProps {
  series: TermTimeSeries[]
  width?: number
  height?: number
  showLegend?: boolean
}

export function TrendChart({
  series,
  width = 600,
  height = 200,
  showLegend = true,
}: TrendChartProps) {
  const { paths, maxCount, timeLabels } = useMemo(() => {
    if (series.length === 0 || series[0]!.points.length === 0) {
      return { paths: [], maxCount: 0, timeLabels: [] }
    }

    // Find global max for Y axis
    let max = 0
    for (const s of series) {
      for (const p of s.points) {
        if (p.count > max) max = p.count
      }
    }
    if (max === 0) max = 1

    const padding = { top: 20, right: 20, bottom: 30, left: 40 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    const numPoints = series[0]!.points.length
    const xStep = numPoints > 1 ? chartW / (numPoints - 1) : chartW

    // Generate paths
    const pathData = series.map((s, idx) => {
      const points = s.points.map((p, i) => {
        const x = padding.left + i * xStep
        const y = padding.top + chartH - (p.count / max) * chartH
        return { x, y }
      })

      // Build SVG path
      let d = ""
      for (let i = 0; i < points.length; i++) {
        const pt = points[i]!
        if (i === 0) {
          d += `M ${pt.x} ${pt.y}`
        } else {
          // Smooth curve using cubic bezier
          const prev = points[i - 1]!
          const cpx = (prev.x + pt.x) / 2
          d += ` C ${cpx} ${prev.y}, ${cpx} ${pt.y}, ${pt.x} ${pt.y}`
        }
      }

      // Area fill path
      const lastPt = points.at(-1)!
      const firstPt = points[0]!
      const areaD = `${d} L ${lastPt.x} ${padding.top + chartH} L ${firstPt.x} ${padding.top + chartH} Z`

      return {
        term: s.term,
        linePath: d,
        areaPath: areaD,
        color: CHART_COLORS[idx % CHART_COLORS.length]!,
        isBurst: s.isBurst,
        lastPoint: lastPt,
      }
    })

    // Time labels
    const labels = series[0]!.points.map((p, i) => {
      const x = padding.left + i * xStep
      const date = new Date(p.timestamp)
      const label = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
      return { x, label }
    })

    return { paths: pathData, maxCount: max, timeLabels: labels }
  }, [series, width, height])

  if (series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-tertiary"
        style={{ width, height }}
      >
        <span className="text-sm">暂无趋势数据，等待更多时间窗口...</span>
      </div>
    )
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const chartH = height - padding.top - padding.bottom

  return (
    <div>
      <svg width={width} height={height} className="overflow-visible">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartH * (1 - ratio)
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeDasharray="3,3"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-text-tertiary"
                fontSize={10}
              >
                {Math.round(maxCount * ratio)}
              </text>
            </g>
          )
        })}

        {/* Area fills (gradient) */}
        <defs>
          {paths.map((p, i) => (
            <linearGradient key={`grad-${i}`} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={p.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {paths.map((p, i) => (
          <path key={`area-${i}`} d={p.areaPath} fill={`url(#area-grad-${i})`} />
        ))}

        {/* Lines */}
        {paths.map((p, i) => (
          <path
            key={`line-${i}`}
            d={p.linePath}
            fill="none"
            stroke={p.color}
            strokeWidth={p.isBurst ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* End dots */}
        {paths.map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p.lastPoint.x}
            cy={p.lastPoint.y}
            r={p.isBurst ? 4 : 3}
            fill={p.color}
          />
        ))}

        {/* X-axis time labels */}
        {timeLabels
          .filter(
            (_, i) =>
              i % Math.max(1, Math.floor(timeLabels.length / 6)) === 0 ||
              i === timeLabels.length - 1,
          )
          .map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-text-tertiary"
              fontSize={10}
            >
              {t.label}
            </text>
          ))}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="mt-3 flex flex-wrap gap-3">
          {paths.map((p) => (
            <div key={p.term} className="flex items-center gap-1.5">
              <div className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-xs text-text-secondary">
                <span>{p.term}</span>
                {p.isBurst && <span className="ml-1 text-red">突发</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
