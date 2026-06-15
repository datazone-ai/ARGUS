import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Send, Sparkles, Loader2, Plus, Maximize2, Minimize2,
  FileText, Settings2, BookOpen, CheckCircle2, Cpu, ChevronRight,
  Paperclip, AlertTriangle, MessageSquare
} from 'lucide-react'
import { useIntelligence } from '../context/IntelligenceContext'
import { useAlerts } from '../context/AlertsContext'
import { useAssets } from '../context/AssetsContext'
import { useWorkOrders } from '../context/WorkOrderContext'
import { useToast } from './Toast'
import { api } from '../services/api'
import type {
  ChatMessage, AIResponse, Section, CasePreview, WorkOrderPreview,
  ChatSource, ContextSources, UploadedFile
} from '../types/intelligence'
import { DEFAULT_CONTEXT_SOURCES } from '../types/intelligence'

// ── Badge helper ──────────────────────────────────────────────────
const BADGE_CLS: Record<string, string> = {
  red:    'bg-red-500/15 text-red-400 border-red-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  amber:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  slate:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
}
function Badge({ text, color = 'slate' }: { text: string; color?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${BADGE_CLS[color] ?? BADGE_CLS.slate}`}>
      {text}
    </span>
  )
}

// ── Section renderer ──────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-white font-semibold">{part}</strong>
      : part
  )
}

function SectionRenderer({ section, preview, setPreview }: {
  section: Section
  preview: PreviewState | null
  setPreview: (p: PreviewState | null) => void
}) {
  switch (section.type) {
    case 'h2':
      return <h2 className="text-white font-bold text-sm mt-1">{section.text}</h2>
    case 'h3':
      return <h3 className="text-white font-semibold text-xs mt-2">{section.text}</h3>
    case 'p':
      return <p className="text-slate-300 text-xs leading-relaxed">{renderInline(section.text)}</p>
    case 'ul':
      return (
        <ul className="space-y-1">
          {section.items.map((item, i) => (
            <li key={i} className="text-slate-300 text-xs flex items-start gap-1.5 leading-relaxed">
              <span className="text-slate-600 mt-0.5 flex-shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
    case 'kv':
      return (
        <div className="space-y-1.5">
          {section.pairs.map((pair, i) => (
            <div key={i} className="flex items-start gap-2 flex-wrap">
              <span className="text-slate-500 text-[11px] flex-shrink-0 w-28 leading-relaxed">{pair.key}</span>
              <span className="text-slate-200 text-[11px] leading-relaxed flex-1 min-w-0">{pair.value}</span>
              {pair.badge && <Badge text={pair.badge.text} color={pair.badge.color} />}
            </div>
          ))}
        </div>
      )
    case 'badge-row':
      return (
        <div className="flex flex-wrap gap-1.5">
          {section.label && <span className="text-slate-500 text-xs self-center mr-1">{section.label}</span>}
          {section.badges.map((b, i) => <Badge key={i} text={b.text} color={b.color} />)}
        </div>
      )
    case 'divider':
      return <hr className="border-[var(--border)] my-1" />
    case 'case-preview':
      return <CasePreviewCard preview={section.preview} setPreview={setPreview} />
    case 'work-order-preview':
      return <WOPreviewCard preview={section.preview} setPreview={setPreview} />
    case 'insufficient':
      return (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-amber-200 text-xs leading-relaxed">{section.message}</p>
        </div>
      )
    default:
      return null
  }
}

// ── Preview state for creation flow ──────────────────────────────
type PreviewState =
  | { type: 'case'; preview: CasePreview; status: 'idle' | 'creating' | 'done'; recordId?: string }
  | { type: 'work-order'; preview: WorkOrderPreview; status: 'idle' | 'creating' | 'done'; recordId?: string }

function CasePreviewCard({ preview, setPreview }: { preview: CasePreview; setPreview: (p: PreviewState | null) => void }) {
  const toast = useToast()
  const { records, updateDraft, confirm, closeModal } = useWorkOrders()
  const [status, setStatus] = useState<'idle' | 'creating' | 'done'>('idle')
  const [recordId, setRecordId] = useState<string | null>(null)

  const handleCreate = async () => {
    setStatus('creating')
    try {
      const payload = {
        type: 'case' as const,
        title: preview.title,
        asset_name: preview.assetName,
        asset_id: preview.assetId,
        linked_well: preview.linkedWell ?? null,
        priority: preview.priority,
        description: preview.description,
        estimated_downtime_hours: null,
        estimated_impact_bopd: null,
        estimated_financial_impact: null,
        source_alert_id: preview.sourceAlertId ?? null,
        assigned_to: null,
        target_date: preview.suggestedDueDate,
      }
      const created = await api.workOrders.create(payload)
      setRecordId(created.id)
      setStatus('done')
      toast.success(`Case created: ${created.id}`)
    } catch {
      toast.error('Failed to create case')
      setStatus('idle')
    }
  }

  return (
    <div className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-violet-600/10 border-b border-violet-500/20 flex items-center gap-2">
        <FileText size={12} className="text-violet-400" />
        <span className="text-violet-300 text-xs font-semibold">Case Preview</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge text={preview.priority.toUpperCase()} color={preview.priority === 'emergency' ? 'red' : preview.priority === 'high' ? 'orange' : 'amber'} />
            <span className="text-slate-400 text-[10px]">Case</span>
          </div>
          <p className="text-white text-xs font-semibold leading-snug">{preview.title}</p>
        </div>
        <div className="text-[11px] text-slate-400 space-y-0.5">
          <span className="block"><span className="text-slate-500">Asset:</span> {preview.assetName}</span>
          <span className="block"><span className="text-slate-500">Team:</span> {preview.recommendedTeam}</span>
          <span className="block"><span className="text-slate-500">Due:</span> {preview.suggestedDueDate}</span>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Evidence</p>
          <ul className="space-y-0.5">
            {preview.evidence.map((e, i) => (
              <li key={i} className="text-slate-300 text-[11px] flex items-start gap-1.5">
                <span className="text-slate-600 flex-shrink-0">•</span>{e}
              </li>
            ))}
          </ul>
        </div>

        {status === 'done' && recordId ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-300 text-xs font-semibold">Case created</p>
              <p className="text-slate-400 text-[10px]">Ref: {recordId}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCreate}
            disabled={status === 'creating'}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {status === 'creating' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {status === 'creating' ? 'Creating…' : 'Create Case'}
          </button>
        )}
      </div>
    </div>
  )
}

function WOPreviewCard({ preview, setPreview }: { preview: WorkOrderPreview; setPreview: (p: PreviewState | null) => void }) {
  const toast = useToast()
  const [status, setStatus] = useState<'idle' | 'creating' | 'done'>('idle')
  const [recordId, setRecordId] = useState<string | null>(null)

  const handleCreate = async () => {
    setStatus('creating')
    try {
      const payload = {
        type: 'work-order' as const,
        title: preview.title,
        asset_name: preview.assetName,
        asset_id: preview.assetId,
        linked_well: preview.linkedWell ?? null,
        priority: preview.priority,
        description: preview.description,
        estimated_downtime_hours: null,
        estimated_impact_bopd: null,
        estimated_financial_impact: null,
        source_alert_id: null,
        assigned_to: null,
        target_date: preview.suggestedDueDate,
      }
      const created = await api.workOrders.create(payload)
      setRecordId(created.id)
      setStatus('done')
      toast.success(`Work Order created: ${created.id}`)
    } catch {
      toast.error('Failed to create work order')
      setStatus('idle')
    }
  }

  return (
    <div className="bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-xl overflow-hidden">
      <div className="px-3 py-2 bg-blue-600/10 border-b border-blue-500/20 flex items-center gap-2">
        <Cpu size={12} className="text-blue-400" />
        <span className="text-blue-300 text-xs font-semibold">Work Order Preview</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge text={preview.priority.toUpperCase()} color={preview.priority === 'emergency' ? 'red' : preview.priority === 'high' ? 'orange' : 'amber'} />
            <Badge text={preview.maintenanceType} color="blue" />
          </div>
          <p className="text-white text-xs font-semibold leading-snug">{preview.title}</p>
        </div>
        <div className="text-[11px] text-slate-400 space-y-0.5">
          <span className="block"><span className="text-slate-500">Asset:</span> {preview.assetName}</span>
          <span className="block"><span className="text-slate-500">Team:</span> {preview.requiredTeam}</span>
          <span className="block"><span className="text-slate-500">Due:</span> {preview.suggestedDueDate}</span>
        </div>
        <div>
          <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Task List</p>
          <ul className="space-y-0.5">
            {preview.taskList.map((t, i) => (
              <li key={i} className="text-slate-300 text-[11px] flex items-start gap-1.5">
                <span className="text-slate-600 flex-shrink-0">{i + 1}.</span>{t}
              </li>
            ))}
          </ul>
        </div>

        {status === 'done' && recordId ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-emerald-300 text-xs font-semibold">Work Order created</p>
              <p className="text-slate-400 text-[10px]">Ref: {recordId}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCreate}
            disabled={status === 'creating'}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            {status === 'creating' ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
            {status === 'creating' ? 'Creating…' : 'Create Work Order'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sources modal ─────────────────────────────────────────────────
function SourcesModal({ sources, reasoning, confidence, missingInfo, onClose }: {
  sources: ChatSource[]
  reasoning: string
  confidence: AIResponse['confidence']
  missingInfo: string[]
  onClose: () => void
}) {
  const confColor = confidence === 'high' ? 'green' : confidence === 'medium' ? 'amber' : 'red'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <BookOpen size={14} className="text-violet-400" /> Response Sources
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-2">Reasoning Summary</p>
            <p className="text-slate-300 text-xs leading-relaxed">{reasoning}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-2">System Data Reviewed</p>
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-slate-300 text-xs capitalize">{s.label}</span>
                  <div className="flex items-center gap-2">
                    {s.details && <span className="text-slate-500 text-[10px]">{s.details}</span>}
                    <span className="text-slate-400 text-xs font-medium">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold">Confidence</p>
            <Badge text={confidence.toUpperCase()} color={confColor} />
          </div>
          {missingInfo.length > 0 && (
            <div>
              <p className="text-slate-500 text-[10px] uppercase tracking-wide font-semibold mb-2">Missing Information</p>
              <ul className="space-y-1">
                {missingInfo.map((m, i) => (
                  <li key={i} className="text-slate-400 text-xs flex items-start gap-1.5">
                    <span className="text-slate-600 flex-shrink-0">•</span>{m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Context sources modal ─────────────────────────────────────────
function ContextModal({ sources, onChange, onClose }: {
  sources: ContextSources
  onChange: (s: ContextSources) => void
  onClose: () => void
}) {
  const ITEMS: { key: keyof ContextSources; label: string }[] = [
    { key: 'assetData',        label: 'Asset master data' },
    { key: 'sensorReadings',   label: 'Sensor readings' },
    { key: 'alerts',           label: 'Alerts' },
    { key: 'maintenanceHistory', label: 'Maintenance history' },
    { key: 'cases',            label: 'Cases' },
    { key: 'workOrders',       label: 'Work orders' },
    { key: 'documents',        label: 'Documents' },
    { key: 'uploadedContext',  label: 'Uploaded context' },
  ]
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-80 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Settings2 size={14} className="text-blue-400" /> Context Sources
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-3 space-y-1">
          {ITEMS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 py-2 cursor-pointer group">
              <div
                className={`w-8 h-4 rounded-full transition-colors ${sources[key] ? 'bg-blue-600' : 'bg-[var(--border-strong)]'}`}
                onClick={() => onChange({ ...sources, [key]: !sources[key] })}
              >
                <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${sources[key] ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-slate-300 text-xs group-hover:text-white transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Thinking animation ────────────────────────────────────────────
function ThinkingBubble({ steps }: { steps: string[] }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={10} className="text-white" />
          </div>
          <span className="text-slate-600 text-[10px] font-medium">Asset Intelligence</span>
        </div>
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-slate-400 text-xs">
            {i === steps.length - 1
              ? <Loader2 size={11} className="animate-spin text-violet-400 flex-shrink-0" />
              : <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />
            }
            <span className={i < steps.length - 1 ? 'text-slate-500' : ''}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────
function MessageBubble({ msg, onShowSources }: { msg: ChatMessage; onShowSources: (msg: ChatMessage) => void }) {
  const dummy: PreviewState | null = null
  const [, setPreview] = useState<PreviewState | null>(null)

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-blue-600/20 border border-blue-500/20 text-slate-200 text-sm leading-relaxed">
          {msg.content}
          {msg.uploadedFiles && msg.uploadedFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {msg.uploadedFiles.map(f => (
                <span key={f.id} className="flex items-center gap-1 text-[10px] bg-[var(--overlay-subtle)] px-2 py-0.5 rounded-full text-slate-400">
                  <Paperclip size={9} />{f.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const r = msg.response
  if (!r) return null

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Sparkles size={10} className="text-white" />
          </div>
          <span className="text-slate-600 text-[10px] font-medium">Asset Intelligence</span>
        </div>
        <div className="space-y-2">
          {r.sections.map((section, i) => (
            <SectionRenderer key={i} section={section} preview={dummy} setPreview={setPreview} />
          ))}
        </div>
        {r.suggestedFollowUps && r.suggestedFollowUps.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-slate-600 text-[10px]">Follow-ups</p>
            {r.suggestedFollowUps.slice(0, 2).map((q, i) => (
              <p key={i} className="text-slate-500 text-[10px] italic leading-relaxed">↳ {q}</p>
            ))}
          </div>
        )}
        <button
          onClick={() => onShowSources(msg)}
          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-violet-400 transition-colors mt-1"
        >
          <BookOpen size={10} /> Sources
        </button>
      </div>
    </div>
  )
}

// ── Chat history panel (full-page left sidebar) ───────────────────
function ChatHistoryPanel({ conversations, activeId, onSelect, onNew }: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  type Conversation = import('../types/intelligence').Conversation
  return (
    <div className="w-64 flex-shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-input)]">
      <div className="px-4 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-white text-xs font-semibold">Conversations</span>
        <button onClick={onNew} className="p-1 rounded-lg hover:bg-[var(--overlay-subtle)] text-slate-400 hover:text-white transition-colors">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-slate-600 text-xs text-center px-4 py-6">No conversations yet.</p>
        )}
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-2.5 hover:bg-[var(--overlay-subtle)] transition-colors ${conv.id === activeId ? 'bg-blue-600/15 border-r-2 border-blue-500' : ''}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={11} className="text-slate-500 flex-shrink-0" />
              <span className="text-slate-300 text-xs font-medium truncate">{conv.title}</span>
            </div>
            <p className="text-slate-600 text-[10px] mt-0.5 truncate pl-4">{conv.lastMessagePreview || 'No messages'}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── GPT response → structured sections ───────────────────────────
const TOOL_SOURCE_MAP: Record<string, ChatSource['type']> = {
  get_open_alerts:       'alert',
  get_asset_status:      'asset',
  get_sensor_history:    'sensor',
  get_sensor_list:       'sensor',
  get_maintenance_history: 'maintenance',
  get_rul_estimates:     'asset',
  get_financial_exposure: 'alert',
  get_work_orders:       'workOrder',
  compare_assets:        'asset',
  get_health_trend:      'asset',
}

function parseTextToAIResponse(text: string, toolsUsed: string[]): AIResponse {
  const lines = text.split('\n')
  const sections: Section[] = []
  let ulBuffer: string[] = []

  const flushUl = () => {
    if (ulBuffer.length) { sections.push({ type: 'ul', items: [...ulBuffer] }); ulBuffer = [] }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushUl(); continue }

    // Numbered list item: "1. **Asset Name**" → h3 heading
    const numbered = line.match(/^\d+\.\s+(.+)$/)
    if (numbered) {
      flushUl()
      const inner = numbered[1].replace(/\*\*/g, '').trim()
      sections.push({ type: 'h3', text: inner })
      continue
    }

    // Bullet (including indented): "- text" or "• text"
    if (/^[-•*]\s+/.test(line)) {
      ulBuffer.push(line.replace(/^[-•*]\s+/, '').trim())
      continue
    }

    flushUl()

    if (line.startsWith('## '))           { sections.push({ type: 'h2', text: line.slice(3) }); continue }
    if (line.startsWith('# '))            { sections.push({ type: 'h2', text: line.slice(2) }); continue }
    if (/^\*\*(.+)\*\*[:\s]*$/.test(line)) { sections.push({ type: 'h3', text: line.replace(/\*\*/g, '').replace(/:$/, '').trim() }); continue }

    sections.push({ type: 'p', text: line })
  }
  flushUl()

  const seenTypes = new Set<string>()
  const sources: ChatSource[] = toolsUsed
    .filter(t => { if (seenTypes.has(t)) return false; seenTypes.add(t); return true })
    .map(t => ({
      type: TOOL_SOURCE_MAP[t] ?? 'asset',
      label: t.replace(/_/g, ' ').replace(/^get /, ''),
      count: 1,
    }))

  return {
    sections: sections.length ? sections : [{ type: 'p', text: text }],
    sources,
    confidence: 'high',
    missingInfo: [],
    reasoning: '',
    suggestedFollowUps: [],
    thinkingLabels: [],
  }
}

// ── Suggested questions ───────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  'Which assets require attention today?',
  'Which assets have active high priority alerts?',
  'What maintenance actions are overdue?',
  'Which work orders are at risk?',
  'Summarise the fleet health',
  'Create a case for the highest risk asset',
]

// ── Main component ────────────────────────────────────────────────
// Also used as: importable ChatPanel for type-only Conversation import
type Conversation = import('../types/intelligence').Conversation

export default function AssetsIntelligence() {
  const {
    isOpen, isFullPage, conversations, activeId, enabledSources,
    open, close, setFullPage, setEnabledSources,
    getActiveConversation, startNewConversation, selectConversation,
    appendMessage, updateLastMessage, addUploadedFile,
  } = useIntelligence()

  const { getOpenAlerts } = useAlerts()
  const { assets } = useAssets()
  const { records: workOrders } = useWorkOrders()
  const toast = useToast()

  const [input, setInput]           = useState('')
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [sourcesMsg, setSourcesMsg] = useState<ChatMessage | null>(null)
  const [showContextModal, setShowContextModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)

  const conv = getActiveConversation()
  const messages = conv?.messages ?? []

  // Auto-start conversation when panel opens
  useEffect(() => {
    if (isOpen && !activeId) startNewConversation()
  }, [isOpen, activeId, startNewConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingSteps])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  const runThinking = useCallback((labels: string[]): Promise<void> => {
    setThinkingSteps([])
    setIsThinking(true)
    return new Promise(resolve => {
      let delay = 0
      labels.forEach((label, i) => {
        delay += 600 + Math.random() * 200
        setTimeout(() => setThinkingSteps(prev => [...prev, label]), delay)
      })
      setTimeout(resolve, delay + 300)
    })
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    // Ensure conversation exists
    if (!activeId) startNewConversation()

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      uploadedFiles: conv?.uploadedFiles.length ? conv.uploadedFiles : undefined,
    }
    appendMessage(userMsg)
    setInput('')

    const chatContext = {
      currentPage: window.location.pathname.split('/').pop() ?? 'overview',
    }

    const history = (conv?.messages ?? [])
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const labels = ['Querying live data', 'Running analysis', 'Reviewing findings', 'Preparing response']

    const [apiResult] = await Promise.all([
      api.chat([...history, { role: 'user', content: trimmed }], chatContext),
      runThinking(labels),
    ])

    setIsThinking(false)
    setThinkingSteps([])

    const response = parseTextToAIResponse(apiResult.response, apiResult.tools_used)

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: apiResult.response,
      response,
      timestamp: new Date().toISOString(),
    }
    appendMessage(assistantMsg)
  }, [isThinking, activeId, conv, appendMessage, getOpenAlerts, workOrders, assets, startNewConversation, runThinking])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const content = await file.text()
      const uploaded: UploadedFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        content: content.slice(0, 50_000),
        uploadedAt: new Date().toISOString(),
      }
      addUploadedFile(uploaded)
      toast.success(`Context added: ${file.name}`)
    } catch {
      toast.error('Failed to read file')
    }
    e.target.value = ''
  }

  if (!isOpen) return null

  const inputArea = (
    <div className="px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
      {conv?.uploadedFiles && conv.uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {conv.uploadedFiles.map(f => (
            <span key={f.id} className="flex items-center gap-1 text-[10px] bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full text-violet-300">
              <Paperclip size={9} />{f.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border)] focus-within:border-blue-500/40 rounded-xl px-3 py-2 transition-colors">
        <button
          onClick={() => fileRef.current?.click()}
          title="Add context file"
          className="flex-shrink-0 text-slate-500 hover:text-violet-400 transition-colors mb-0.5 p-0.5"
        >
          <Paperclip size={14} />
        </button>
        <input ref={fileRef} type="file" accept=".txt,.pdf,.csv,.md,.json" className="hidden" onChange={handleFileUpload} />
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about assets, alerts, maintenance…"
          disabled={isThinking}
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none max-h-28 leading-relaxed disabled:opacity-50"
          style={{ scrollbarWidth: 'none' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isThinking}
          className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors mb-0.5"
        >
          <Send size={12} className="text-white" />
        </button>
      </div>
      <p className="text-slate-700 text-[10px] mt-1 text-center">Enter to send · Shift+Enter for new line · Paperclip to add context</p>
    </div>
  )

  const chatArea = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && !isThinking && (
        <div className="space-y-5">
          <div className="text-center pt-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles size={20} className="text-violet-400" />
            </div>
            <p className="text-white text-sm font-semibold">Asset Intelligence</p>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed max-w-xs mx-auto">
              Ask questions about asset health, alerts, maintenance, cases, work orders, and supporting documents.
            </p>
          </div>
          <div className="space-y-1.5">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-blue-500/30 hover:bg-blue-500/5 text-slate-400 hover:text-slate-200 text-xs transition-colors leading-relaxed flex items-center gap-2"
              >
                <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map(msg => (
        <MessageBubble key={msg.id} msg={msg} onShowSources={setSourcesMsg} />
      ))}

      {isThinking && <ThinkingBubble steps={thinkingSteps} />}
      <div ref={bottomRef} />
    </div>
  )

  const headerActions = (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setShowContextModal(true)}
        title="Context sources"
        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-[var(--overlay-subtle)] transition-colors"
      >
        <Settings2 size={14} />
      </button>
      <button
        onClick={() => setFullPage(!isFullPage)}
        title={isFullPage ? 'Collapse' : 'Expand to full page'}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[var(--overlay-subtle)] transition-colors"
      >
        {isFullPage ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
      <button
        onClick={close}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[var(--overlay-subtle)] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )

  const header = (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} className="text-white" />
        </div>
        <div>
          <p className="text-white text-sm font-semibold leading-none">Asset Intelligence</p>
          <p className="text-slate-600 text-[10px] mt-0.5">Assets · Alerts · Maintenance · Cases · Work Orders</p>
        </div>
      </div>
      {headerActions}
    </div>
  )

  return (
    <>
      {/* Full-page mode */}
      {isFullPage && (
        <div className="fixed inset-0 z-50 flex bg-[var(--bg-base)]">
          <ChatHistoryPanel
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            onNew={startNewConversation}
          />
          <div className="flex-1 flex flex-col">
            {header}
            {chatArea}
            {inputArea}
          </div>
        </div>
      )}

      {/* Side panel mode */}
      {!isFullPage && (
        <>
          <div className="fixed inset-0 z-40 bg-[var(--overlay-dark)] backdrop-blur-[1px] lg:hidden" onClick={close} />
          <div className="fixed right-0 top-0 h-screen w-[420px] z-50 flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl">
            {header}
            {chatArea}
            {inputArea}
          </div>
        </>
      )}

      {/* Modals */}
      {sourcesMsg?.response && (
        <SourcesModal
          sources={sourcesMsg.response.sources}
          reasoning={sourcesMsg.response.reasoning}
          confidence={sourcesMsg.response.confidence}
          missingInfo={sourcesMsg.response.missingInfo}
          onClose={() => setSourcesMsg(null)}
        />
      )}
      {showContextModal && (
        <ContextModal
          sources={enabledSources}
          onChange={setEnabledSources}
          onClose={() => setShowContextModal(false)}
        />
      )}
    </>
  )
}

// ── Floating launch button ────────────────────────────────────────
export function IntelligenceFloatBtn() {
  const { isOpen, toggle } = useIntelligence()
  if (isOpen) return null
  return (
    <button
      onClick={toggle}
      title="Open Asset Intelligence"
      className="fixed bottom-6 right-6 z-40 w-13 h-13 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-900/40 flex items-center justify-center transition-all duration-200 hover:scale-105 border border-violet-500/30"
      style={{ width: 52, height: 52 }}
    >
      <Sparkles size={20} className="text-white" />
    </button>
  )
}
