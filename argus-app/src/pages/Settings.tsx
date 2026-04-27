import { useState } from 'react'
import TopBar from '../components/layout/TopBar'
import { Save, Plug, CheckCircle2, XCircle, Clock } from 'lucide-react'

const connectors = [
  { name: 'PI Historian (AVEVA)', type: 'Real-time Sensor', status: 'stubbed', lastSync: 'Not configured' },
  { name: 'SCADA (Honeywell)', type: 'Real-time Telemetry', status: 'stubbed', lastSync: 'Not configured' },
  { name: 'OFM / Avocet (SLB)', type: 'Production Data', status: 'stubbed', lastSync: 'Not configured' },
  { name: 'SAP PM / S4HANA', type: 'Maintenance Records', status: 'stubbed', lastSync: 'Not configured' },
  { name: 'IBM Maximo', type: 'Asset Management', status: 'stubbed', lastSync: 'Not configured' },
  { name: 'PostgreSQL', type: 'Structured DB', status: 'active', lastSync: 'Synthetic data loaded' },
]

export default function Settings() {
  const [oilPrice, setOilPrice] = useState('97.00')
  const [currency, setCurrency] = useState('USD')
  const [criticalThreshold, setCriticalThreshold] = useState('85')
  const [highThreshold, setHighThreshold] = useState('70')
  const [staleThreshold, setStaleThreshold] = useState('15')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" subtitle="Financial parameters, alert thresholds, data connectors" />
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Financial settings */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Financial & Operational</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-500 text-xs block mb-1.5">Oil Price (per barrel)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    value={oilPrice}
                    onChange={e => setOilPrice(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-500 text-xs block mb-1.5">Display Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="USD">USD ($)</option>
                  <option value="NGN">NGN (₦)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-slate-500 text-xs block mb-1">
                Sensor Staleness Threshold (minutes)
              </label>
              <p className="text-slate-600 text-[10px] mb-1.5">Flag a sensor as stale if no reading received within this interval</p>
              <input
                type="number"
                value={staleThreshold}
                onChange={e => setStaleThreshold(e.target.value)}
                className="w-32 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
        </div>

        {/* Alert thresholds */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-1">Alert Severity Thresholds</h3>
          <p className="text-slate-500 text-xs mb-4">ML model confidence % that triggers each severity level</p>
          <div className="space-y-3">
            {[
              { label: 'Critical Alert Threshold', val: criticalThreshold, set: setCriticalThreshold, color: 'text-red-400' },
              { label: 'High Alert Threshold', val: highThreshold, set: setHighThreshold, color: 'text-orange-400' },
            ].map(({ label, val, set, color }) => (
              <div key={label} className="flex items-center gap-4">
                <label className={`text-xs w-48 ${color}`}>{label}</label>
                <input
                  type="range" min={50} max={99} value={val}
                  onChange={e => set(e.target.value)}
                  className="flex-1"
                />
                <span className="text-white text-sm font-bold w-12 text-right">{val}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Connectors */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h3 className="text-white font-semibold text-sm">Data Connectors</h3>
            <p className="text-slate-500 text-xs mt-0.5">Real-time and batch data sources. Currently running on synthetic data.</p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {connectors.map(c => (
              <div key={c.name} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plug size={14} className={c.status === 'active' ? 'text-emerald-400' : 'text-slate-600'} />
                  <div>
                    <p className="text-slate-200 text-xs font-medium">{c.name}</p>
                    <p className="text-slate-600 text-[10px]">{c.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px]">
                    <Clock size={10} className="text-slate-600" />
                    <span className="text-slate-600">{c.lastSync}</span>
                  </div>
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-500'}`}>
                    {c.status === 'active' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                    {c.status === 'active' ? 'Active' : 'Not configured'}
                  </span>
                  <button className="px-2.5 py-1 rounded-lg bg-[var(--overlay-subtle)] hover:bg-[var(--overlay-mild)] text-slate-400 text-[10px] transition-colors">
                    Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
        >
          {saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
