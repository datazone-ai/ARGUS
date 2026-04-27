import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Alert } from '../types'
import { api } from '../services/api'

export interface WorkOrder {
  id: string
  type: 'work-order' | 'case'
  title: string
  assetName: string
  assetId: string
  linkedWell: string | null
  priority: 'emergency' | 'high' | 'medium' | 'low'
  description: string
  estimatedDowntimeHours: number
  estimatedImpactBopd: number
  estimatedFinancialImpact: number
  sourceAlertId: string | null
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: string
  assignedTo: string
  targetDate: string
  fieldNotes: string
  updatedAt: string | null
  closedAt: string | null
}

interface WOState {
  records: WorkOrder[]
  modalOpen: boolean
  modalType: 'work-order' | 'case' | null
  draft: Partial<WorkOrder> | null
}

type Action =
  | { type: 'OPEN_MODAL'; draft: Partial<WorkOrder>; modalType: 'work-order' | 'case' }
  | { type: 'CLOSE_MODAL' }
  | { type: 'UPDATE_DRAFT'; patch: Partial<WorkOrder> }
  | { type: 'ADD_RECORD'; record: WorkOrder }
  | { type: 'SET_RECORDS'; records: WorkOrder[] }

function reducer(state: WOState, action: Action): WOState {
  switch (action.type) {
    case 'OPEN_MODAL':
      return { ...state, modalOpen: true, modalType: action.modalType, draft: action.draft }
    case 'CLOSE_MODAL':
      return { ...state, modalOpen: false, draft: null, modalType: null }
    case 'UPDATE_DRAFT':
      return { ...state, draft: { ...state.draft, ...action.patch } }
    case 'ADD_RECORD':
      return { ...state, records: [action.record, ...state.records] }
    case 'SET_RECORDS':
      return { ...state, records: action.records }
    default:
      return state
  }
}

function rowToWorkOrder(d: any): WorkOrder {
  return {
    id: d.id,
    type: d.type as WorkOrder['type'],
    title: d.title,
    assetName: d.asset_name,
    assetId: d.asset_id,
    linkedWell: d.linked_well ?? null,
    priority: d.priority as WorkOrder['priority'],
    description: d.description,
    estimatedDowntimeHours: d.estimated_downtime_hours ?? 0,
    estimatedImpactBopd: d.estimated_impact_bopd ?? 0,
    estimatedFinancialImpact: d.estimated_financial_impact ?? 0,
    sourceAlertId: d.source_alert_id ?? null,
    status: d.status as WorkOrder['status'],
    createdAt: d.created_at ?? new Date().toISOString(),
    assignedTo: d.assigned_to ?? '',
    targetDate: d.target_date ?? '',
    fieldNotes: d.field_notes ?? '',
    updatedAt: d.updated_at ?? null,
    closedAt: d.closed_at ?? null,
  }
}

const DATA_ANCHOR = new Date('2024-12-31T23:00:00Z')

function draftFromAlert(alert: Alert, type: 'work-order' | 'case'): Partial<WorkOrder> {
  const urgencyDays = type === 'work-order'
    ? Math.max(1, alert.timeToFailureMin - 2)
    : alert.timeToFailureMin
  const targetDate = new Date(DATA_ANCHOR.getTime() + urgencyDays * 86400000).toISOString().slice(0, 10)
  const priority = alert.severity === 'critical' ? 'emergency' : alert.severity === 'high' ? 'high' : 'medium'

  return {
    type,
    assetName: alert.assetName,
    assetId: alert.assetId,
    linkedWell: alert.linkedWell,
    priority,
    title: type === 'work-order'
      ? `[${alert.severity.toUpperCase()}] ${alert.title}`
      : `Investigation: ${alert.title}`,
    description: type === 'work-order'
      ? alert.recommendedAction
      : `OBSERVATION:\n${alert.observation}\n\nPATTERN MATCH:\n${alert.patternMatch}\n\nINVESTIGATION SCOPE:\nInvestigate root cause of the above observation. Document findings, attach any relevant sensor logs or inspection photos, and determine whether a Work Order should be raised.`,
    estimatedDowntimeHours: type === 'work-order' ? Math.round(alert.timeToFailureMin * 0.5) : 0,
    estimatedImpactBopd: alert.predictedImpactBopd,
    estimatedFinancialImpact: alert.financialImpactUsd,
    sourceAlertId: alert.id,
    assignedTo: '',
    targetDate,
  }
}

interface WOContextValue {
  records: WorkOrder[]
  loadingRecords: boolean
  modalOpen: boolean
  modalType: 'work-order' | 'case' | null
  draft: Partial<WorkOrder> | null
  openFromAlert: (alert: Alert, type: 'work-order' | 'case') => void
  closeModal: () => void
  updateDraft: (patch: Partial<WorkOrder>) => void
  confirm: () => Promise<string | null>
}

const WOContext = createContext<WOContextValue | null>(null)

export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { records: [], modalOpen: false, draft: null, modalType: null })
  const [loadingRecords, setLoadingRecords] = useState(true)

  useEffect(() => {
    api.workOrders.list()
      .then(rows => {
        dispatch({ type: 'SET_RECORDS', records: rows.map(rowToWorkOrder) })
        setLoadingRecords(false)
      })
      .catch(() => setLoadingRecords(false))
  }, [])

  const openFromAlert = useCallback((alert: Alert, type: 'work-order' | 'case') => {
    dispatch({ type: 'OPEN_MODAL', draft: draftFromAlert(alert, type), modalType: type })
  }, [])

  const closeModal = useCallback(() => dispatch({ type: 'CLOSE_MODAL' }), [])

  const updateDraft = useCallback((patch: Partial<WorkOrder>) =>
    dispatch({ type: 'UPDATE_DRAFT', patch }), [])

  const confirm = useCallback(async (): Promise<string | null> => {
    const { draft, modalType } = state
    if (!draft || !modalType) return null

    const payload = {
      type: modalType,
      title: draft.title ?? '',
      asset_name: draft.assetName ?? '',
      asset_id: draft.assetId ?? '',
      linked_well: draft.linkedWell ?? null,
      priority: draft.priority ?? 'high',
      description: draft.description ?? '',
      estimated_downtime_hours: draft.estimatedDowntimeHours ?? null,
      estimated_impact_bopd: draft.estimatedImpactBopd ?? null,
      estimated_financial_impact: draft.estimatedFinancialImpact ?? null,
      source_alert_id: draft.sourceAlertId ?? null,
      assigned_to: draft.assignedTo ?? null,
      target_date: draft.targetDate ?? null,
    }

    const created = await api.workOrders.create(payload)
    dispatch({ type: 'ADD_RECORD', record: rowToWorkOrder(created) })
    dispatch({ type: 'CLOSE_MODAL' })
    return draft.sourceAlertId ?? null
  }, [state])

  return (
    <WOContext.Provider value={{ ...state, loadingRecords, openFromAlert, closeModal, updateDraft, confirm }}>
      {children}
    </WOContext.Provider>
  )
}

export function useWorkOrders() {
  const ctx = useContext(WOContext)
  if (!ctx) throw new Error('useWorkOrders must be used inside WorkOrderProvider')
  return ctx
}
