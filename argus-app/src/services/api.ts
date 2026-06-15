import type { Asset, Alert, MaintenanceRecord, Sensor, SensorReading } from '../types'

const BASE = 'http://localhost:8001'

function raw<T>(path: string): Promise<T> {
  return fetch(`${BASE}${path}`).then(r => {
    if (!r.ok) throw new Error(`API ${r.status}: ${path}`)
    return r.json()
  })
}

function post<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) throw new Error(`API ${r.status}: ${path}`)
    return r.json()
  })
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (!r.ok) throw new Error(`API ${r.status}: ${path}`)
    return r.json()
  })
}

// --- Transform helpers ---

function transformSensor(s: any): Sensor {
  return {
    id: s.id,
    name: s.name,
    type: s.type,
    unit: s.unit,
    currentValue: s.current_value ?? s.baseline,
    baseline: s.baseline,
    loAlarm: s.lo_alarm,
    hiAlarm: s.hi_alarm,
    status: s.status ?? 'normal',
    lastUpdated: s.last_updated ?? new Date().toISOString(),
    history: (s.history ?? []).map((h: any) => ({
      timestamp: h.time ?? h.timestamp,
      value: h.value,
    })) as SensorReading[],
  }
}

function transformFailureMode(fm: any) {
  return {
    name: fm.name,
    probability: fm.probability,
    contributingFactor: fm.description ?? fm.contributingFactor ?? '',
  }
}

function transformAsset(a: any): Asset {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    location: a.location,
    facility: a.facility,
    associatedWell: a.associated_well ?? null,
    parentAsset: a.parent_asset ?? null,
    healthScore: a.health_score,
    status: a.status,
    manufacturer: a.manufacturer ?? '',
    installDate: a.install_date ?? '',
    lastMaintenance: a.last_maintenance ?? '',
    nextScheduledMaintenance: a.next_scheduled_maintenance ?? '',
    ratedCapacity: a.rated_capacity ?? '',
    operatingHours: a.operating_hours ?? 0,
    sensors: (a.sensors ?? []).map(transformSensor),
    failureModes: (a.failure_modes ?? []).map(transformFailureMode),
  }
}

function transformAlert(a: any): Alert {
  return {
    id: a.id,
    assetId: a.asset_id,
    assetName: a.asset_name,
    linkedWell: a.linked_well ?? null,
    severity: a.severity,
    type: a.type,
    title: a.title,
    observation: a.observation,
    patternMatch: a.pattern_match,
    recommendedAction: a.recommended_action,
    riskIfIgnored: a.risk_if_ignored,
    confidenceScore: a.confidence_score,
    timeToFailureMin: a.time_to_failure_min,
    timeToFailureMax: a.time_to_failure_max,
    predictedImpactBopd: a.predicted_impact_bopd,
    financialImpactUsd: a.financial_impact_usd,
    triggeredAt: a.triggered_at,
    status: a.status,
    sensors: a.sensors ?? [],
  }
}

function transformMaintenance(m: any): MaintenanceRecord {
  return {
    id: m.id,
    assetId: m.asset_id,
    assetName: m.asset_name,
    date: m.date,
    type: m.type,
    technician: m.technician,
    duration: m.duration,
    findings: m.findings,
    outcome: m.outcome,
    nextDue: m.next_due,
  }
}

// --- Public API ---

export const api = {
  assets: {
    list: (): Promise<Asset[]> =>
      raw<any[]>('/assets/').then(rows => rows.map(transformAsset)),

    get: (id: string): Promise<Asset> =>
      raw<any>(`/assets/${id}`).then(transformAsset),

    sensorHistory: (assetId: string, sensorId: string, hours = 168): Promise<SensorReading[]> =>
      raw<any[]>(`/assets/${assetId}/sensors/${sensorId}/history?hours=${hours}`).then(rows =>
        rows.map(r => ({ timestamp: r.time, value: r.value }))
      ),

    healthHistory: (assetId: string, days = 30): Promise<{ time: string; health_score: number }[]> =>
      raw(`/assets/${assetId}/health-history?days=${days}`),
  },

  alerts: {
    list: (): Promise<Alert[]> =>
      raw<any[]>('/alerts/').then(rows => rows.map(transformAlert)),

    updateStatus: (id: string, status: string): Promise<Alert> =>
      patch<any>(`/alerts/${id}/status`, { status }).then(transformAlert),
  },

  maintenance: {
    list: (): Promise<MaintenanceRecord[]> =>
      raw<any[]>('/maintenance/').then(rows => rows.map(transformMaintenance)),

    byAsset: (assetId: string): Promise<MaintenanceRecord[]> =>
      raw<any[]>(`/maintenance/?asset_id=${assetId}`).then(rows => rows.map(transformMaintenance)),
  },

  predictions: {
    rul: () => raw('/predictions/rul'),
    riskMatrix: () => raw('/predictions/risk-matrix'),
    declineCurves: (assetId: string) => raw(`/predictions/decline-curves/${assetId}`),
  },

  workOrders: {
    create: (body: unknown) => post<any>('/work-orders/', body),
    list: (params?: { status?: string; asset_id?: string; assigned_to?: string }) => {
      const qs = new URLSearchParams()
      if (params?.status)      qs.set('status', params.status)
      if (params?.asset_id)    qs.set('asset_id', params.asset_id)
      if (params?.assigned_to) qs.set('assigned_to', params.assigned_to)
      const query = qs.toString() ? `?${qs}` : ''
      return raw<any[]>(`/work-orders/${query}`)
    },
    get: (id: string) => raw<any>(`/work-orders/${id}`),
    updateStatus: (id: string, status: string, fieldNotes?: string) =>
      fetch(`${BASE}/work-orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, field_notes: fieldNotes ?? null }),
      }).then(r => { if (!r.ok) throw new Error(`API ${r.status}`); return r.json() }),
    transform: (d: any) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      assetName: d.asset_name,
      assetId: d.asset_id,
      linkedWell: d.linked_well ?? null,
      priority: d.priority,
      description: d.description,
      estimatedDowntimeHours: d.estimated_downtime_hours ?? 0,
      estimatedImpactBopd: d.estimated_impact_bopd ?? 0,
      estimatedFinancialImpact: d.estimated_financial_impact ?? 0,
      sourceAlertId: d.source_alert_id ?? null,
      status: d.status,
      createdAt: d.created_at ?? '',
      assignedTo: d.assigned_to ?? '',
      targetDate: d.target_date ?? '',
      fieldNotes: d.field_notes ?? '',
      updatedAt: d.updated_at ?? null,
      closedAt: d.closed_at ?? null,
    }),
  },

  production: {
    wells: () => raw<any[]>('/production/wells'),
    summary: () => raw<any>('/production/summary'),
  },

  chat: (messages: { role: string; content: string }[], context: object) =>
    post<{ response: string; tools_used: string[] }>('/chat/', { messages, context }),
}
