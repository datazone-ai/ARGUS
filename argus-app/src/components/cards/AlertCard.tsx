import type { Alert } from '../../types'
import { AlertTriangle, Clock, DollarSign, TrendingDown, Zap, ChevronDown, ChevronUp, BellOff, CheckCircle2, Cpu } from 'lucide-react'
import { useState } from 'react'
import { formatDistance } from 'date-fns'

const DATA_ANCHOR = new Date('2024-12-31T23:00:00Z')
import { useAlerts } from '../../context/AlertsContext'
import { useWorkOrders } from '../../context/WorkOrderContext'
import { useToast } from '../Toast'

const severityConfig = {
  critical: { label: 'CRITICAL', bg: 'bg-red-500/10', border: 'border-red-500/40', badge: 'bg-red-500 text-white', icon: 'text-red-400' },
  high:     { label: 'HIGH',     bg: 'bg-orange-500/10', border: 'border-orange-500/40', badge: 'bg-orange-500 text-white', icon: 'text-orange-400' },
  medium:   { label: 'MEDIUM',   bg: 'bg-amber-500/10', border: 'border-amber-500/40', badge: 'bg-amber-500 text-white', icon: 'text-amber-400' },
  low:      { label: 'LOW',      bg: 'bg-blue-500/10', border: 'border-blue-500/40', badge: 'bg-blue-600 text-white', icon: 'text-blue-400' },
}

interface AlertCardProps {
  alert: Alert
  compact?: boolean
}

export default function AlertCard({ alert, compact = false }: AlertCardProps) {
  const [expanded, setExpanded] = useState(!compact)
  const { dismiss, snooze } = useAlerts()
  const { openFromAlert } = useWorkOrders()
  const toast = useToast()
  const cfg = severityConfig[alert.severity]

  const handleDismiss = () => {
    dismiss(alert.id)
    toast.warning(`Alert dismissed: ${alert.assetName}`)
  }

  const handleSnooze = () => {
    snooze(alert.id)
    toast.warning(`Alert snoozed 24h: ${alert.assetName}`)
  }

  const handleCreateWO = () => {
    openFromAlert(alert, 'work-order')
  }

  const handleCreateCase = () => {
    openFromAlert(alert, 'case')
  }

  const formatUsd = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1_000).toFixed(0)}K`

  return (
    <div className={`rounded-xl border ${cfg.bg} ${cfg.border} overflow-hidden`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${cfg.icon}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-slate-400 text-xs font-medium">{alert.assetName}</span>
              {alert.linkedWell && (
                <span className="text-slate-600 text-xs">· {alert.linkedWell}</span>
              )}
              <span className="text-slate-600 text-xs ml-auto flex items-center gap-1">
                <Clock size={11} />
                {formatDistance(new Date(alert.triggeredAt), DATA_ANCHOR, { addSuffix: true })}
              </span>
            </div>
            <h3 className="text-white text-sm font-semibold leading-snug">{alert.title}</h3>
          </div>
          {compact && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="bg-[var(--overlay-dark)] rounded-lg p-2">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Zap size={10} /> Confidence
            </div>
            <div className="text-white text-sm font-bold">{alert.confidenceScore}%</div>
          </div>
          <div className="bg-[var(--overlay-dark)] rounded-lg p-2">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Clock size={10} /> Time to Failure
            </div>
            <div className="text-white text-sm font-bold">{alert.timeToFailureMin}–{alert.timeToFailureMax}d</div>
          </div>
          <div className="bg-[var(--overlay-dark)] rounded-lg p-2">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <DollarSign size={10} /> Financial Risk
            </div>
            <div className={`text-sm font-bold ${cfg.icon}`}>{formatUsd(alert.financialImpactUsd)}</div>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Observation</p>
            <p className="text-slate-300 text-xs leading-relaxed">{alert.observation}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Pattern Match</p>
            <p className="text-slate-300 text-xs leading-relaxed">{alert.patternMatch}</p>
          </div>
          <div className="bg-blue-950/40 border border-blue-500/20 rounded-lg p-3">
            <p className="text-[10px] text-blue-400 uppercase tracking-wide font-semibold mb-1">Recommended Action</p>
            <p className="text-slate-200 text-xs leading-relaxed">{alert.recommendedAction}</p>
          </div>
          <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-3">
            <p className="text-[10px] text-red-400 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
              <TrendingDown size={10} /> Risk If Ignored
            </p>
            <p className="text-slate-200 text-xs leading-relaxed">{alert.riskIfIgnored}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={handleCreateWO}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              <Cpu size={12} /> Create Work Order
            </button>
            <button
              onClick={handleCreateCase}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-subtle)] hover:bg-[var(--overlay-mild)] text-slate-300 text-xs font-medium transition-colors"
            >
              <CheckCircle2 size={12} /> Create Case
            </button>
            <button
              onClick={handleSnooze}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-subtle)] hover:bg-[var(--overlay-mild)] text-slate-300 text-xs font-medium transition-colors"
            >
              <BellOff size={12} /> Snooze 24h
            </button>
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--overlay-subtle)] hover:bg-[var(--overlay-mild)] text-slate-400 text-xs font-medium transition-colors ml-auto"
            >
              <CheckCircle2 size={12} /> Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
