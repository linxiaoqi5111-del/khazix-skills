/**
 * FinHot Hotword Dashboard — full-page view with trend charts,
 * burst indicators, word cloud, and stats overview.
 */

import { useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"

import { useSubViewTitle } from "~/modules/app-layout/subview/hooks"

import { hotwordDashboardAtom, hotwordTimeSeriesAtom } from "../store"
import { BurstCards } from "./BurstCards"
import { StatsOverview } from "./StatsOverview"
import { TrendChart } from "./TrendChart"
import { WordCloud } from "./WordCloud"

export function HotwordDashboard() {
  useSubViewTitle(<span>热词看板</span>, "热词看板")

  const dashboard = useAtomValue(hotwordDashboardAtom)
  const timeSeries = useAtomValue(hotwordTimeSeriesAtom)

  // Responsive chart width
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(600)

  const updateWidth = useCallback(() => {
    if (containerRef.current) {
      const w = containerRef.current.offsetWidth
      setChartWidth(Math.max(300, w - 48)) // padding
    }
  }, [])

  useEffect(() => {
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
  }, [updateWidth])

  const isEmpty = dashboard.totalArticles === 0

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-5xl space-y-6 px-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text">热词看板</h1>
        <p className="mt-2 text-sm text-text-secondary">实时监控金融信息源中的高频词汇和突发话题</p>
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Stats Overview */}
          <section>
            <StatsOverview
              totalArticles={dashboard.totalArticles}
              totalTerms={dashboard.totalTerms}
              burstCount={dashboard.bursting.length}
              trendingCount={dashboard.trending.length}
            />
          </section>

          {/* Burst & Trending Cards */}
          <section>
            <SectionHeader title="突发与趋势" subtitle="频率异常上升的热词" />
            <BurstCards bursting={dashboard.bursting} trending={dashboard.trending} />
          </section>

          {/* Trend Chart */}
          <section>
            <SectionHeader title="频率趋势" subtitle="Top 热词在各时间窗口的出现频次" />
            <div className="rounded-xl border border-fill-secondary bg-fill-tertiary p-4">
              <TrendChart series={timeSeries} width={chartWidth} height={220} />
            </div>
          </section>

          {/* Word Cloud */}
          <section>
            <SectionHeader title="词频全景" subtitle="所有被识别的金融关键词" />
            <WordCloud
              terms={[...dashboard.bursting, ...dashboard.trending, ...dashboard.stable]}
            />
          </section>
        </>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="text-xs text-text-tertiary">{subtitle}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-fill-secondary bg-fill-tertiary px-8 py-16">
      <div className="mb-4 text-5xl">📊</div>
      <h2 className="mb-2 text-lg font-semibold text-text">暂无数据</h2>
      <p className="max-w-md text-center text-sm text-text-secondary">
        热词看板需要先订阅信息源并等待文章被分析。 请确保已订阅至少一个 RSS
        源，系统会自动收集热词数据。
      </p>
      <div className="mt-6 rounded-lg bg-fill-secondary px-4 py-2 text-xs text-text-tertiary">
        数据每 30 秒自动刷新
      </div>
    </div>
  )
}
