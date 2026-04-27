import { useEffect, useState } from 'react'
import TopBar from '../components/layout/TopBar'
import { api } from '../services/api'
import { Droplets, Flame, TrendingDown, TrendingUp, Minus, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

interface Well {
  id: string
  name: string
  field: string
  facility: string
  linked_asset_id: string | null
  fluid_type: string
  current_rate: number
  target_rate: number
  rate_unit: string
  water_cut_pct: number
  gor_scf_bbl: number
  wellhead_pressure_barg: number
  choke_size_64ths: number | null
  status: string
  uptime_30d_pct: number
  last_well_test: string | null
  production_trend: string
}

interface Summary {
  total_oil_bopd: number
  target_oil_bopd: number
  oil_efficiency_pct: number
  total_gas_mmscfd: number
  target_gas_mmscfd: number
  gas_efficiency_pct: number
  well_count: number
  status_breakdown: Record<string, number>
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  flowing:   { label: 'Flowing',    color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: CheckCircle2 },
  restricted:{ label: 'Restricted', color: 'text-amber-400',   bg: 'bg-amber-500/15',   icon: AlertTriangle },
  shut_in:   { label: 'Shut-In',    color: 'text-red-400',     bg: 'bg-red-500/15',     icon: AlertTriangle },
  on_test:   { label: 'On Test',    color: 'text-blue-400',    bg: 'bg-blue-500/15',    icon: Minus },
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'declining') return <TrendingDown size={12} className="text-red-400" />
  if (trend === 'improving') return <TrendingUp size={12} className="text-emerald-400" />
  return <Minus size={12} className="text-slate-500" />
}

function RateBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, (current / target) * 100)
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="w-full bg-[var(--border)] rounded-full h-1.5 mt-1.5">
      <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Production() {
  const [wells, setWells]     = useState<Well[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.production.wells(),
      api.production.summary(),
    ]).then(([w, s]) => {
      setWells(w)
      setSummary(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Production & Well Performance" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <Loader2 size={20} className="animate-spin mr-2" /> Fetching production data...
        </div>
      </div>
    )
  }

  const oilWells = wells.filter(w => w.fluid_type === 'oil')
  const gasWells = wells.filter(w => w.fluid_type === 'gas')

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Production & Well Performance"
        subtitle={`${wells.length} wells monitored · ${summary?.status_breakdown?.flowing ?? 0} flowing · ${summary?.status_breakdown?.restricted ?? 0} restricted`}
      />
      <div className="p-6 space-y-6">

        {/* KPI summary row */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets size={13} className="text-blue-400" />
                <p className="text-slate-400 text-xs">Oil Production</p>
              </div>
              <p className="text-white text-xl font-bold">{summary.total_oil_bopd.toLocaleString()}</p>
              <p className="text-slate-500 text-xs mt-0.5">BOPD of {summary.target_oil_bopd.toLocaleString()} target</p>
              <RateBar current={summary.total_oil_bopd} target={summary.target_oil_bopd} />
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={13} className="text-orange-400" />
                <p className="text-slate-400 text-xs">Gas Production</p>
              </div>
              <p className="text-white text-xl font-bold">{summary.total_gas_mmscfd.toFixed(1)}</p>
              <p className="text-slate-500 text-xs mt-0.5">MMScfd of {summary.target_gas_mmscfd.toFixed(1)} target</p>
              <RateBar current={summary.total_gas_mmscfd} target={summary.target_gas_mmscfd} />
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-2">Oil Efficiency</p>
              <p className={`text-xl font-bold ${summary.oil_efficiency_pct >= 85 ? 'text-emerald-400' : summary.oil_efficiency_pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {summary.oil_efficiency_pct}%
              </p>
              <p className="text-slate-500 text-xs mt-0.5">of nameplate capacity</p>
            </div>
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-2">Gas Efficiency</p>
              <p className={`text-xl font-bold ${summary.gas_efficiency_pct >= 85 ? 'text-emerald-400' : summary.gas_efficiency_pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                {summary.gas_efficiency_pct}%
              </p>
              <p className="text-slate-500 text-xs mt-0.5">of nameplate capacity</p>
            </div>
          </div>
        )}

        {/* Oil Wells */}
        {oilWells.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Droplets size={14} className="text-blue-400" />
              <h2 className="text-white font-semibold text-sm">Oil Wells</h2>
              <span className="text-slate-500 text-xs">({oilWells.length})</span>
            </div>
            {oilWells.map(w => <WellCard key={w.id} well={w} />)}
          </div>
        )}

        {/* Gas Wells */}
        {gasWells.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame size={14} className="text-orange-400" />
              <h2 className="text-white font-semibold text-sm">Gas Wells</h2>
              <span className="text-slate-500 text-xs">({gasWells.length})</span>
            </div>
            {gasWells.map(w => <WellCard key={w.id} well={w} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function WellCard({ well }: { well: Well }) {
  const st = statusConfig[well.status] ?? statusConfig.flowing
  const Icon = st.icon
  const efficiencyPct = Math.round((well.current_rate / well.target_rate) * 100)
  const effColor = efficiencyPct >= 85 ? 'text-emerald-400' : efficiencyPct >= 60 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-semibold">{well.name}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>
              <Icon size={9} /> {st.label}
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{well.facility} · {well.field}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <TrendIcon trend={well.production_trend} />
            <span className="text-slate-500 text-xs capitalize">{well.production_trend}</span>
          </div>
          {well.linked_asset_id && (
            <p className="text-slate-600 text-[10px] mt-0.5">Asset: {well.linked_asset_id}</p>
          )}
        </div>
      </div>

      {/* Rate bar */}
      <div className="mb-3">
        <div className="flex items-end justify-between mb-1">
          <span className="text-slate-400 text-xs">Production Rate</span>
          <span className={`text-xs font-bold ${effColor}`}>{efficiencyPct}% of target</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-white text-lg font-bold">
            {well.fluid_type === 'oil' ? well.current_rate.toLocaleString() : well.current_rate.toFixed(1)}
          </span>
          <span className="text-slate-400 text-xs">{well.rate_unit}</span>
          <span className="text-slate-600 text-xs ml-1">/ {well.fluid_type === 'oil' ? well.target_rate.toLocaleString() : well.target_rate.toFixed(1)} target</span>
        </div>
        <RateBar current={well.current_rate} target={well.target_rate} />
      </div>

      {/* Parameters grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-slate-600 mb-0.5">Wellhead Pressure</p>
          <p className="text-slate-300 font-medium">{well.wellhead_pressure_barg} barg</p>
        </div>
        <div>
          <p className="text-slate-600 mb-0.5">Water Cut</p>
          <p className={`font-medium ${well.water_cut_pct > 50 ? 'text-amber-400' : 'text-slate-300'}`}>{well.water_cut_pct}%</p>
        </div>
        {well.choke_size_64ths && (
          <div>
            <p className="text-slate-600 mb-0.5">Choke Size</p>
            <p className="text-slate-300 font-medium">{well.choke_size_64ths}/64"</p>
          </div>
        )}
        <div>
          <p className="text-slate-600 mb-0.5">30-Day Uptime</p>
          <p className={`font-medium ${well.uptime_30d_pct >= 90 ? 'text-emerald-400' : well.uptime_30d_pct >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
            {well.uptime_30d_pct}%
          </p>
        </div>
        {well.gor_scf_bbl > 0 && (
          <div>
            <p className="text-slate-600 mb-0.5">GOR</p>
            <p className="text-slate-300 font-medium">{well.gor_scf_bbl} scf/bbl</p>
          </div>
        )}
        {well.last_well_test && (
          <div>
            <p className="text-slate-600 mb-0.5">Last Well Test</p>
            <p className="text-slate-300 font-medium">{well.last_well_test}</p>
          </div>
        )}
      </div>
    </div>
  )
}
