import { useWorkOrders } from '../../context/WorkOrderContext'
import { useAlerts } from '../../context/AlertsContext'
import { ENGINEERS } from '../../context/AuthContext'
import { X, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../Toast'

const priorityOptions = ['Emergency', 'High', 'Medium', 'Low']
const jobCategories   = ['Inspection', 'Corrective Maintenance', 'Preventive Maintenance', 'Lubrication', 'Calibration', 'Overhaul', 'Safety']
const alertFeedback   = ['True Positive', 'False Positive', 'Inconclusive']

export default function WorkOrderModal() {
  const { modalOpen, modalType, draft, closeModal, updateDraft, confirm } = useWorkOrders()
  const { acknowledge } = useAlerts()
  const toast = useToast()
  const [caseTab, setCaseTab] = useState<'new' | 'existing'>('new')
  const [saving, setSaving] = useState(false)

  // Extra local fields not stored in the shared draft (case-specific)
  const [caseComment, setCaseComment]             = useState('')
  const [alertFeedbackVal, setAlertFeedbackVal]   = useState('True Positive')
  const [alertComment, setAlertComment]           = useState('')
  const [estDowntimeCost, setEstDowntimeCost]     = useState('')
  const [estMaintenanceCost, setEstMaintenanceCost] = useState('')
  // WO-specific
  const [jobCategory, setJobCategory]             = useState('')
  const [woType]                                   = useState('Risk')

  useEffect(() => {
    if (!modalOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalOpen, closeModal])

  // Reset local fields when modal opens
  useEffect(() => {
    if (modalOpen) {
      setCaseTab('new')
      setCaseComment('')
      setAlertFeedbackVal('True Positive')
      setAlertComment('')
      setEstDowntimeCost('')
      setEstMaintenanceCost('')
      setJobCategory('')
    }
  }, [modalOpen])

  if (!modalOpen || !draft) return null

  const isWO = modalType === 'work-order'

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const sourceAlertId = await confirm()
      if (sourceAlertId) acknowledge(sourceAlertId)
      toast.success(isWO
        ? `Work Order created for ${draft.assetName}`
        : `Case opened for ${draft.assetName}`
      )
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60'
  const labelCls = 'text-slate-400 text-xs block mb-1.5'
  const selectCls = `${inputCls} cursor-pointer`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

      <div className="relative w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-white font-semibold text-sm">
            {isWO ? 'Create Work Order' : 'Add to Case'}
          </h2>
          <button onClick={closeModal} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Case tabs */}
        {!isWO && (
          <div className="flex border-b border-[var(--border)]">
            {(['new', 'existing'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCaseTab(tab)}
                className={`px-5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  caseTab === tab
                    ? 'text-blue-400 border-blue-400'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {tab === 'new' ? 'New Case' : 'Existing Case'}
              </button>
            ))}
          </div>
        )}

        {/* Form body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          {/* ── WORK ORDER FORM ── */}
          {isWO && (
            <>
              {/* Type tag */}
              <div>
                <label className={labelCls}>Type</label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-medium">
                    {woType}
                  </span>
                </div>
              </div>

              {/* WO # */}
              <div>
                <label className={labelCls}>Work Order #</label>
                <input
                  type="text"
                  value={draft.id ?? ''}
                  readOnly
                  placeholder="Auto-generated on save"
                  className={`${inputCls} text-slate-500`}
                />
              </div>

              {/* Job Category */}
              <div>
                <label className={labelCls}>Job Category</label>
                <select value={jobCategory} onChange={e => setJobCategory(e.target.value)} className={selectCls}>
                  <option value="">Select category...</option>
                  {jobCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={4}
                  value={draft.description ?? ''}
                  onChange={e => updateDraft({ description: e.target.value })}
                  className={`${inputCls} resize-none leading-relaxed`}
                />
              </div>

              {/* Equipment */}
              <div>
                <label className={labelCls}>Equipment</label>
                <input
                  type="text"
                  value={draft.assetName ?? ''}
                  readOnly
                  className={`${inputCls} text-slate-500 cursor-not-allowed`}
                />
              </div>

              {/* Priority + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Priority</label>
                  <select
                    value={draft.priority ? draft.priority.charAt(0).toUpperCase() + draft.priority.slice(1) : 'High'}
                    onChange={e => updateDraft({ priority: e.target.value.toLowerCase() as any })}
                    className={selectCls}
                  >
                    {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Due Date</label>
                  <input
                    type="date"
                    value={draft.targetDate ?? ''}
                    onChange={e => updateDraft({ targetDate: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Operator */}
              <div>
                <label className={labelCls}>Operator / Assigned To</label>
                <select
                  value={draft.assignedTo ?? ''}
                  onChange={e => updateDraft({ assignedTo: e.target.value })}
                  className={selectCls}
                >
                  <option value="">Select engineer...</option>
                  {ENGINEERS.map(e => (
                    <option key={e.id} value={e.name}>{e.name} — {e.specialisation}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* ── CASE FORM ── */}
          {!isWO && caseTab === 'new' && (
            <>
              {/* Case Name + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Case Name</label>
                  <input
                    type="text"
                    value={draft.title ?? ''}
                    onChange={e => updateDraft({ title: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Case Priority</label>
                  <select
                    value={draft.priority ? draft.priority.charAt(0).toUpperCase() + draft.priority.slice(1) : 'High'}
                    onChange={e => updateDraft({ priority: e.target.value.toLowerCase() as any })}
                    className={selectCls}
                  >
                    {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Case Comment + Assignee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Case Comment <span className="text-slate-600">(Optional)</span></label>
                  <textarea
                    rows={3}
                    value={caseComment}
                    onChange={e => setCaseComment(e.target.value)}
                    placeholder="Enter comment here"
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Assignee</label>
                  <select
                    value={draft.assignedTo ?? ''}
                    onChange={e => updateDraft({ assignedTo: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">Select assignee...</option>
                    {ENGINEERS.map(e => (
                      <option key={e.id} value={e.name}>{e.name} — {e.specialisation}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost estimates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Est. Cost of Unplanned Downtime ($) <span className="text-slate-600">(Optional)</span></label>
                  <input
                    type="number"
                    value={estDowntimeCost}
                    onChange={e => setEstDowntimeCost(e.target.value)}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Est. Cost of Unplanned Maintenance ($) <span className="text-slate-600">(Optional)</span></label>
                  <input
                    type="number"
                    value={estMaintenanceCost}
                    onChange={e => setEstMaintenanceCost(e.target.value)}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Alert feedback */}
              <div>
                <label className={labelCls}>Select Alert Feedback <span className="text-slate-600">(Optional)</span></label>
                <select value={alertFeedbackVal} onChange={e => setAlertFeedbackVal(e.target.value)} className={selectCls}>
                  {alertFeedback.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Comment for alert */}
              <div>
                <label className={labelCls}>Comment for Alert <span className="text-slate-600">(Optional)</span></label>
                <textarea
                  rows={3}
                  value={alertComment}
                  onChange={e => setAlertComment(e.target.value)}
                  placeholder="Provide additional comments for this alert"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </>
          )}

          {/* Existing Case tab */}
          {!isWO && caseTab === 'existing' && (
            <div className="py-6 text-center text-slate-500 text-sm">
              <p>Search for an existing case to link this alert to.</p>
              <input
                type="text"
                placeholder="Search by case name or ID..."
                className={`${inputCls} mt-4 text-left`}
              />
              <p className="text-slate-600 text-xs mt-3">No existing cases found.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-3">
          <button
            onClick={closeModal}
            className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--overlay-subtle)] text-slate-400 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : <CheckCircle2 size={14} />
            }
            {saving ? 'Saving...' : isWO ? 'Save' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
