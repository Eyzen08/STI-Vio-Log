import { useEffect, useMemo, useRef, useState } from 'react'
import { analyticsForRange, analyticsInsights, availablePrograms, manilaDateKey, periodRange } from '../lib/dashboardAnalytics.js'
import { API_URL } from '../lib/api.js'

const number = new Intl.NumberFormat('en-PH')
const shortDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const longDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
const date = (key, formatter = longDate) => formatter.format(new Date(`${key}T00:00:00Z`))
const message = (loading, error, empty) => loading ? 'Loading analytics…' : error ? 'Analytics unavailable. Please refresh the page.' : empty ? 'No records for this selection.' : ''

export async function downloadAnalytics(snapshot, format) {
  const response = await fetch(`${API_URL}/api/reports/analytics.${format}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot)
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error?.message || data.message || 'Unable to export analytics. Please try again.')
  }
  const url = URL.createObjectURL(await response.blob())
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `STI_Vio-Log_Analytics_${snapshot.range.from}_${snapshot.range.to}.${format}`
    anchor.click()
  } finally { URL.revokeObjectURL(url) }
}

function HorizontalBars({ items, color = 'blue' }) {
  const max = Math.max(1, ...items.map((item) => item.count))
  return <dl className={`analytics-bars analytics-bars--${color}`}>{items.map((item) => <div key={item.level || item.label}>
    <dt>{item.label}</dt><dd><span className="analytics-bar-track"><i style={{ width: `${item.count / max * 100}%` }}/></span><strong>{item.display || number.format(item.count)}</strong></dd>
  </div>)}</dl>
}

function DashboardAnalytics({ students, violations, assignments, loading, error }) {
  const [today] = useState(() => manilaDateKey())
  const firstRange = useMemo(() => periodRange('THIS_MONTH', today), [today])
  const [period, setPeriod] = useState('THIS_MONTH')
  const [program, setProgram] = useState('ALL')
  const [customFrom, setCustomFrom] = useState(firstRange.from)
  const [customTo, setCustomTo] = useState(firstRange.to)
  const [lastValidRange, setLastValidRange] = useState(firstRange)
  const [selectedBucket, setSelectedBucket] = useState(0)
  const [exportFormat, setExportFormat] = useState('xlsx')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportStatus, setExportStatus] = useState('')
  const exportInFlight = useRef(false)
  const range = periodRange(period, today, customFrom, customTo)
  useEffect(() => { if (range) setLastValidRange(range) }, [range?.from, range?.to, range?.previousFrom, range?.previousTo])
  const appliedRange = range || lastValidRange
  const options = useMemo(() => availablePrograms(students), [students])
  const analytics = useMemo(() => analyticsForRange({ students, violations, assignments, range: appliedRange, program }), [students, violations, assignments, appliedRange, program])
  const trendPoint = analytics.trend[selectedBucket] || analytics.trend[0]
  const activeBucket = Math.min(selectedBucket, analytics.trend.length - 1)
  const largestTrend = Math.max(1, ...analytics.trend.map((bucket) => bucket.count))
  const violationState = message(loading, error, !analytics.violationCount)
  const serviceState = message(loading, error, !analytics.service.total)
  const insightState = message(loading, error, !analytics.violationCount && !analytics.previousViolationCount && !analytics.service.total)
  const insights = analyticsInsights(analytics)
  const exportDisabled = loading || Boolean(error) || !range || exporting
  const exportSnapshot = async () => {
    if (exportDisabled || exportInFlight.current) return
    exportInFlight.current = true
    setExporting(true); setExportError(''); setExportStatus('Preparing analytics download…')
    try {
      await downloadAnalytics({ range: appliedRange, program, analytics, insights }, exportFormat)
      setExportStatus('Analytics download ready.')
    } catch (downloadError) {
      setExportError(downloadError.message || 'Unable to export analytics. Please try again.')
      setExportStatus('')
    } finally { exportInFlight.current = false; setExporting(false) }
  }

  return <section className="dashboard-analytics" aria-labelledby="dashboard-analytics-title">
    <div className="dashboard-analytics-heading">
      <div><h2 id="dashboard-analytics-title">Analytics &amp; Trends</h2><p>Monitor violation patterns, service completion, and student compliance.</p></div>
      <div className="dashboard-analytics-filters">
        <label>Date range<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="THIS_MONTH">This Month</option><option value="LAST_MONTH">Last Month</option><option value="THIS_YEAR">This Year</option><option value="CUSTOM">Custom</option></select></label>
        <label>Department / Program<select value={program} onChange={(event) => setProgram(event.target.value)}><option value="ALL">All Departments / Programs</option>{options.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        {period === 'CUSTOM' && <div className="dashboard-analytics-custom"><label>From<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)}/></label><label>To<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)}/></label></div>}
        <div className="dashboard-analytics-export">
          <label>Export format<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} disabled={exporting}><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (.csv)</option></select></label>
          <button type="button" className="primary-action" onClick={exportSnapshot} disabled={exportDisabled} data-action-disabled={Boolean(exportDisabled)} aria-busy={exporting}>{exporting ? 'Exporting…' : 'Export'}</button>
        </div>
      </div>
    </div>
    {period === 'CUSTOM' && !range && <p className="dashboard-analytics-error" role="alert">Choose valid dates with From on or before To. Showing the last valid range.</p>}
    {exportError && <p className="dashboard-analytics-error" role="alert">{exportError}</p>}
    {exportStatus && <p className="analytics-unavailable" role="status">{exportStatus}</p>}
    <div className="dashboard-analytics-grid">
      <article className="dashboard-card analytics-card"><header className="dashboard-section-heading"><div><h3>Recorded Violations Over Time</h3><p>{date(appliedRange.from)} – {date(appliedRange.to)}</p></div></header>
        {violationState ? <p className="empty-state">{violationState}</p> : <><div className="analytics-trend" role="group" aria-label="Recorded violations by time period">{analytics.trend.map((bucket, index) => <button key={bucket.from} type="button" className={index === activeBucket ? 'selected' : ''} onFocus={() => setSelectedBucket(index)} onClick={() => setSelectedBucket(index)} aria-label={`${date(bucket.from)} to ${date(bucket.to)}: ${number.format(bucket.count)} recorded violations`} aria-pressed={index === activeBucket}>
          <strong>{number.format(bucket.count)}</strong><span className="analytics-trend-plot"><i style={{ height: `${Math.max(3, bucket.count / largestTrend * 100)}%` }}/></span><small>{date(bucket.from, shortDate)}</small>
        </button>)}</div><p className="analytics-trend-detail" aria-live="polite">{date(trendPoint.from)} – {date(trendPoint.to)} · {number.format(trendPoint.count)} violation{trendPoint.count === 1 ? '' : 's'}</p></>}
      </article>
      <article className="dashboard-card analytics-card"><header className="dashboard-section-heading"><div><h3>Violations by Classification</h3><p>Current student classification across selected records</p></div></header>
        {violationState ? <p className="empty-state">{violationState}</p> : <HorizontalBars items={analytics.classifications}/>}
      </article>
      <article className="dashboard-card analytics-card"><header className="dashboard-section-heading"><div><h3>Community Service Status</h3><p>Current status of assignments created in the selected range</p></div></header>
        {serviceState ? <p className="empty-state">{serviceState}</p> : <><div className="analytics-service-summary"><strong>{analytics.service.completionPercent}%</strong><span>of {number.format(analytics.service.total)} assignments completed</span></div><HorizontalBars items={[{ label: 'Completed', count: analytics.service.completed, display: `${number.format(analytics.service.completed)} · ${analytics.service.completionPercent}%` }, { label: 'In Progress', count: analytics.service.active, display: `${number.format(analytics.service.active)} · ${100 - analytics.service.completionPercent}%` }]} color="service"/></>}
        {!loading && !error && <p className="analytics-unavailable">Overdue data unavailable</p>}
      </article>
      <article className="dashboard-card analytics-card"><header className="dashboard-section-heading"><div><h3>Violations by Department</h3><p>Grouped by the student’s recorded program or strand</p></div></header>
        {violationState ? <p className="empty-state">{violationState}</p> : <HorizontalBars items={analytics.programs}/>}
      </article>
      <article className="dashboard-card analytics-card analytics-insights"><header className="dashboard-section-heading"><div><h3>Key Insights</h3><p>What needs attention in the selected range</p></div></header>
        {insightState ? <p className="empty-state">{insightState}</p> : <dl>{insights.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
      </article>
    </div>
  </section>
}

export default DashboardAnalytics
