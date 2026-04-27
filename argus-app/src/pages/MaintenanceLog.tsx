import TopBar from '../components/layout/TopBar'
import { useMaintenance } from '../context/MaintenanceContext'
import { useWorkOrders } from '../context/WorkOrderContext'
import { Wrench, Calendar, ClipboardList, Clock } from 'lucide-react'

const typeConfig: Record<string, { color: string; bg: string }> = {
  overhaul:    { color: 'text-purple-400', bg: 'bg-purple-500/20' },
  corrective:  { color: 'text-red-400',    bg: 'bg-red-500/20' },
  inspection:  { color: 'text-blue-400',   bg: 'bg-blue-500/20' },
  preventive:  { color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  'work-order': { color: 'text-orange-400', bg: 'bg-orange-500/20' },
  case:        { color: 'text-violet-400', bg: 'bg-violet-500/20' },
}

const priorityConfig: Record<string, { color: string; bg: string }> = {
  emergency: { color: 'text-red-400',     bg: 'bg-red-500/15' },
  high:      { color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  medium:    { color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  low:       { color: 'text-blue-400',    bg: 'bg-blue-500/15' },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  confirmed:   { label: 'Confirmed',   color: 'text-blue-400' },
  in_progress: { label: 'In Progress', color: 'text-amber-400' },
  completed:   { label: 'Completed',   color: 'text-emerald-400' },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-500' },
}

export default function MaintenanceLog() {
  const { records } = useMaintenance()
  const { records: workOrders } = useWorkOrders()

  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const activeWOs = workOrders.filter(w => w.status !== 'completed' && w.status !== 'cancelled')

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="Maintenance Log"
        subtitle={`${activeWOs.length} active work orders · ${records.length} maintenance records`}
      />
      <div className="p-6 space-y-6">

        {/* ── Active Work Orders ── */}
        {activeWOs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={14} className="text-orange-400" />
              <h2 className="text-white font-semibold text-sm">Active Work Orders & Cases</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-medium">
                {activeWOs.length} open
              </span>
            </div>
            {activeWOs.map(wo => {
              const typeCfg = typeConfig[wo.type] ?? typeConfig.corrective
              const priCfg = priorityConfig[wo.priority] ?? priorityConfig.medium
              const stCfg = statusConfig[wo.status] ?? statusConfig.confirmed
              return (
                <div key={wo.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${typeCfg.bg}`}>
                        <ClipboardList size={14} className={typeCfg.color} />
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold">{wo.assetName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeCfg.bg} ${typeCfg.color}`}>
                            {wo.type === 'work-order' ? 'Work Order' : 'Case'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priCfg.bg} ${priCfg.color}`}>
                            {wo.priority.charAt(0).toUpperCase() + wo.priority.slice(1)}
                          </span>
                          <span className={`text-[10px] font-medium ${stCfg.color}`}>● {stCfg.label}</span>
                          <span className="text-slate-600 text-xs">{wo.id}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <Calendar size={11} />
                        {wo.createdAt.slice(0, 10)}
                      </div>
                      {wo.targetDate && (
                        <p className="text-slate-600 text-xs mt-0.5">
                          Due: {wo.targetDate}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="text-white font-medium leading-snug">{wo.title}</p>
                    <p className="text-slate-400 leading-relaxed line-clamp-3">{wo.description}</p>
                    <div className="flex items-center gap-4 pt-1">
                      {wo.assignedTo && (
                        <p className="text-slate-500">
                          <span className="font-medium">Assigned: </span>{wo.assignedTo}
                        </p>
                      )}
                      {wo.estimatedDowntimeHours > 0 && (
                        <p className="text-slate-500 flex items-center gap-1">
                          <Clock size={10} />
                          {wo.estimatedDowntimeHours}h estimated
                        </p>
                      )}
                      {wo.sourceAlertId && (
                        <p className="text-slate-600 text-[10px]">from alert {wo.sourceAlertId}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Maintenance Records ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <Wrench size={14} className="text-slate-400" />
              Maintenance Records
            </h2>
            {(['overhaul', 'preventive', 'inspection', 'corrective'] as const).map(t => {
              const cfg = typeConfig[t]
              const count = records.filter(m => m.type === t).length
              return (
                <div key={t} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${cfg.bg} ${cfg.color}`}>
                  <span className="font-medium capitalize">{t}</span>
                  <span className="font-bold">{count}</span>
                </div>
              )
            })}
          </div>

          {sorted.map(record => {
            const cfg = typeConfig[record.type]
            return (
              <div key={record.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cfg.bg}`}>
                      <Wrench size={14} className={cfg.color} />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{record.assetName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                          {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                        </span>
                        <span className="text-slate-600 text-xs">{record.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                      <Calendar size={11} />
                      {record.date}
                    </div>
                    <p className="text-slate-600 text-xs mt-0.5">{record.duration}h duration</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  <p className="text-slate-400"><span className="text-slate-500 font-medium">Technician: </span>{record.technician}</p>
                  <p className="text-slate-400 leading-relaxed"><span className="text-slate-500 font-medium">Findings: </span>{record.findings}</p>
                  <p className="text-slate-400 leading-relaxed"><span className="text-slate-500 font-medium">Outcome: </span>{record.outcome}</p>
                  <p className="text-slate-600"><span className="font-medium">Next due: </span>{record.nextDue}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
