import type { AIResponse, Section, ChatSource, CasePreview, WorkOrderPreview, BadgeColor } from '../types/intelligence'
import type { Alert } from '../types'
import type { WorkOrder } from '../context/WorkOrderContext'
import type { Asset } from '../types'

const DATA_ANCHOR = new Date('2024-12-31T23:00:00Z')
function daysFromAnchor(days: number): string {
  return new Date(DATA_ANCHOR.getTime() + days * 86400000).toISOString().slice(0, 10)
}

export interface SystemContext {
  alerts: Alert[]
  workOrders: WorkOrder[]
  assets: Asset[]
}

type Intent =
  | 'assets-attention'
  | 'explain-risk'
  | 'create-case'
  | 'create-work-order'
  | 'maintenance-overdue'
  | 'maintenance-priority'
  | 'fleet-health'
  | 'alerts-summary'
  | 'sensor-status'
  | 'default'

function detectIntent(message: string): Intent {
  const q = message.toLowerCase()
  if ((q.includes('create') || q.includes('raise') || q.includes('open')) && q.includes('work order')) return 'create-work-order'
  if ((q.includes('create') || q.includes('raise') || q.includes('open')) && (q.includes('case') || q.includes('investigation'))) return 'create-case'
  if (q.includes('overdue') || (q.includes('maintenance') && (q.includes('action') || q.includes('due') || q.includes('schedule')))) return 'maintenance-overdue'
  if ((q.includes('first') || q.includes('which')) && (q.includes('overdue') || q.includes('priority'))) return 'maintenance-priority'
  if (q.includes('attention') || (q.includes('today') && q.includes('asset')) || q.includes('require attention')) return 'assets-attention'
  if (q.includes('why') || (q.includes('risk') && (q.includes('explain') || q.includes('marked') || q.includes('reason')))) return 'explain-risk'
  if (q.includes('sensor') || q.includes('reading') || q.includes('abnormal')) return 'sensor-status'
  if (q.includes('health') || q.includes('fleet') || q.includes('summary') || q.includes('status')) return 'fleet-health'
  if (q.includes('alert')) return 'alerts-summary'
  return 'default'
}

function sevColor(sev: string): BadgeColor {
  if (sev === 'critical') return 'red'
  if (sev === 'high') return 'orange'
  if (sev === 'medium') return 'amber'
  return 'blue'
}

function prioColor(p: string): BadgeColor {
  if (p === 'emergency') return 'red'
  if (p === 'high') return 'orange'
  if (p === 'medium') return 'amber'
  return 'blue'
}

function extractAsset(message: string, assets: Asset[]): Asset | undefined {
  const q = message.toLowerCase()
  return assets.find(a =>
    q.includes(a.name.toLowerCase()) || q.includes(a.id.toLowerCase())
  )
}

function thinkingFor(intent: Intent): string[] {
  const base: Record<Intent, string[]> = {
    'assets-attention':    ['Reviewing asset health scores', 'Checking active alert queue', 'Assessing maintenance schedules', 'Ranking by operational risk'],
    'explain-risk':        ['Retrieving asset record', 'Reviewing active alerts', 'Checking sensor readings', 'Analysing maintenance history'],
    'create-case':         ['Retrieving asset record', 'Reviewing relevant alerts', 'Gathering supporting evidence', 'Preparing case preview'],
    'create-work-order':   ['Retrieving asset record', 'Checking maintenance schedule', 'Reviewing work order history', 'Preparing work order preview'],
    'maintenance-overdue': ['Checking work order schedules', 'Reviewing overdue items', 'Assessing asset criticality', 'Ranking by risk level'],
    'maintenance-priority':['Ranking overdue maintenance items', 'Reviewing asset criticality', 'Checking alert severity', 'Assessing operational risk'],
    'fleet-health':        ['Reviewing all asset health scores', 'Checking sensor statuses', 'Reviewing active alerts', 'Compiling fleet summary'],
    'alerts-summary':      ['Retrieving active alert queue', 'Sorting by severity', 'Matching assets to alerts', 'Preparing alert summary'],
    'sensor-status':       ['Reviewing sensor readings', 'Checking alarm thresholds', 'Identifying abnormal patterns', 'Preparing sensor summary'],
    'default':             ['Reviewing available system data', 'Checking alerts and assets', 'Reviewing maintenance records', 'Preparing response'],
  }
  return base[intent]
}

// ── Intent handlers ───────────────────────────────────────────────

function handleAssetsAttention(ctx: SystemContext): AIResponse {
  const openAlerts = ctx.alerts.filter(a => !['dismissed', 'snoozed'].includes((a as any).status ?? ''))
  const critical = openAlerts.filter(a => a.severity === 'critical')
  const high = openAlerts.filter(a => a.severity === 'high')
  const priority = [...critical, ...high].slice(0, 5)

  const criticalAssets = ctx.assets.filter(a => a.status === 'critical' || a.healthScore < 50)
  const degraded = ctx.assets.filter(a => a.status === 'degraded' && a.healthScore < 70)

  const sections: Section[] = [
    { type: 'h2', text: 'Assets Requiring Attention Today' },
    { type: 'p', text: `${priority.length} priority asset${priority.length !== 1 ? 's' : ''} identified from active alerts and health scores. ${critical.length > 0 ? `${critical.length} critical alert${critical.length !== 1 ? 's' : ''} require immediate action.` : ''}` },
    { type: 'divider' },
    { type: 'h3', text: 'Priority Assets' },
  ]

  if (priority.length > 0) {
    sections.push({
      type: 'kv',
      pairs: priority.map(a => ({
        key: a.assetName,
        value: a.title.length > 60 ? a.title.slice(0, 60) + '…' : a.title,
        badge: { text: a.severity.toUpperCase(), color: sevColor(a.severity) },
      })),
    })
  } else {
    sections.push({ type: 'p', text: 'No critical or high severity alerts found in the active queue.' })
  }

  if (criticalAssets.length > 0 || degraded.length > 0) {
    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Asset Health Concerns' })
    const healthConcerns = [...criticalAssets, ...degraded].slice(0, 4)
    sections.push({
      type: 'ul',
      items: healthConcerns.map(a => `${a.name} — Health score ${a.healthScore}% (${a.status})`),
    })
  }

  sections.push({ type: 'divider' })
  sections.push({ type: 'h3', text: 'Recommended Next Steps' })
  sections.push({
    type: 'ul',
    items: [
      'Review critical alerts and acknowledge within 1 hour',
      'Assign field engineers to inspect flagged assets',
      'Create work orders for confirmed fault conditions',
      'Escalate any unacknowledged critical alerts to the operations lead',
    ],
  })

  return {
    sections,
    sources: [
      { type: 'alert', label: 'Alert Queue', count: openAlerts.length, details: `${critical.length} critical, ${high.length} high` },
      { type: 'asset', label: 'Asset Register', count: ctx.assets.length, details: `${criticalAssets.length} critical status` },
      { type: 'maintenance', label: 'Maintenance Log', count: ctx.workOrders.filter(w => w.type === 'work-order').length },
    ],
    confidence: priority.length > 0 ? 'high' : 'medium',
    missingInfo: ['Real-time SCADA sensor values not available in mock mode', 'Vibration inspection reports not loaded'],
    reasoning: 'The assistant reviewed the active alert queue, sorted by severity, and cross-referenced with asset health scores to identify the highest-priority assets for attention today.',
    suggestedFollowUps: [
      'Why is ' + (priority[0]?.assetName ?? 'the top asset') + ' marked as high risk?',
      'Create a case for the highest risk asset',
      'What maintenance actions are overdue?',
    ],
    thinkingLabels: thinkingFor('assets-attention'),
  }
}

function handleExplainRisk(message: string, ctx: SystemContext): AIResponse {
  const asset = extractAsset(message, ctx.assets)
  const assetAlerts = asset
    ? ctx.alerts.filter(a => a.assetId === asset.id)
    : ctx.alerts.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 3)

  const targetName = asset?.name ?? 'the queried asset'

  if (assetAlerts.length === 0 && !asset) {
    return {
      sections: [
        { type: 'insufficient', message: 'I could not identify a specific asset from your question, and no critical alerts match the description. Please specify the asset name (e.g. "Why is COMP-A high risk?").' },
      ],
      sources: [],
      confidence: 'insufficient',
      missingInfo: ['Asset name not identified in query'],
      reasoning: 'No matching asset found in the query.',
      suggestedFollowUps: ['Which assets require attention today?', 'Show me all active alerts'],
      thinkingLabels: thinkingFor('explain-risk'),
    }
  }

  const topAlert = assetAlerts[0]
  const assetWOs = ctx.workOrders.filter(w => w.assetId === (asset?.id ?? topAlert?.assetId))

  const sections: Section[] = [
    { type: 'h2', text: `Risk Explanation — ${targetName}` },
  ]

  if (asset) {
    sections.push({
      type: 'kv',
      pairs: [
        { key: 'Health Score', value: `${asset.healthScore}%`, badge: { text: asset.status.toUpperCase(), color: asset.status === 'critical' ? 'red' : asset.status === 'degraded' ? 'orange' : 'green' } },
        { key: 'Asset Type', value: asset.type.charAt(0).toUpperCase() + asset.type.slice(1) },
        { key: 'Location', value: asset.location },
      ],
    })
    sections.push({ type: 'divider' })
  }

  sections.push({ type: 'h3', text: 'Risk Summary' })
  if (topAlert) {
    sections.push({ type: 'p', text: topAlert.observation })
  }

  if (assetAlerts.length > 0) {
    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Evidence Reviewed' })
    sections.push({
      type: 'kv',
      pairs: assetAlerts.map(a => ({
        key: a.title.slice(0, 50),
        value: `Confidence ${a.confidenceScore}% · TTF ${a.timeToFailureMin}–${a.timeToFailureMax}d`,
        badge: { text: a.severity.toUpperCase(), color: sevColor(a.severity) },
      })),
    })
  }

  if (topAlert) {
    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Pattern Match' })
    sections.push({ type: 'p', text: topAlert.patternMatch })
    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Operational Impact' })
    sections.push({
      type: 'kv',
      pairs: [
        { key: 'Financial Risk', value: topAlert.financialImpactUsd >= 1_000_000 ? `$${(topAlert.financialImpactUsd / 1_000_000).toFixed(1)}M` : `$${(topAlert.financialImpactUsd / 1000).toFixed(0)}K` },
        { key: 'Production at Risk', value: `${topAlert.predictedImpactBopd} BOPD` },
        { key: 'Risk if Ignored', value: topAlert.riskIfIgnored.slice(0, 100) + (topAlert.riskIfIgnored.length > 100 ? '…' : '') },
      ],
    })
    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Recommended Action' })
    sections.push({ type: 'p', text: topAlert.recommendedAction })
  }

  return {
    sections,
    sources: [
      { type: 'asset', label: 'Asset Record', count: 1, details: targetName },
      { type: 'alert', label: 'Active Alerts', count: assetAlerts.length },
      { type: 'workOrder', label: 'Work Orders', count: assetWOs.length },
      { type: 'sensor', label: 'Sensor Readings', count: asset?.sensors.length ?? 0 },
    ],
    confidence: topAlert ? 'high' : 'medium',
    missingInfo: ['Recent vibration inspection document not found', 'SCADA historian data not available in mock mode'],
    reasoning: `The assistant retrieved the ${targetName} asset record, reviewed its active alerts, sensor readings, and maintenance history to explain the current risk classification.`,
    suggestedFollowUps: [
      `Create a case for ${targetName} ${topAlert?.title.split(' ').slice(0, 4).join(' ') ?? 'risk'}`,
      'What maintenance actions are overdue?',
      'Which assets require attention today?',
    ],
    thinkingLabels: thinkingFor('explain-risk'),
  }
}

function handleCreateCase(message: string, ctx: SystemContext): AIResponse {
  const asset = extractAsset(message, ctx.assets)
  const assetAlerts = asset
    ? ctx.alerts.filter(a => a.assetId === asset.id && (a.severity === 'critical' || a.severity === 'high'))
    : ctx.alerts.filter(a => a.severity === 'critical').slice(0, 1)

  const topAlert = assetAlerts[0] ?? ctx.alerts[0]
  const targetAsset = asset ?? ctx.assets.find(a => a.id === topAlert?.assetId)

  if (!targetAsset || !topAlert) {
    return {
      sections: [{ type: 'insufficient', message: 'I could not identify a specific asset or alert to create a case for. Please specify an asset name, e.g. "Create a case for COMP-A vibration risk".' }],
      sources: [],
      confidence: 'insufficient',
      missingInfo: ['Asset name not provided'],
      reasoning: 'No matching asset found.',
      suggestedFollowUps: ['Which assets require attention today?'],
      thinkingLabels: thinkingFor('create-case'),
    }
  }

  const preview: CasePreview = {
    title: `${topAlert.title.slice(0, 60)} — ${targetAsset.name}`,
    assetName: targetAsset.name,
    assetId: targetAsset.id,
    linkedWell: topAlert.linkedWell,
    priority: topAlert.severity === 'critical' ? 'emergency' : topAlert.severity === 'high' ? 'high' : 'medium',
    description: `OBSERVATION:\n${topAlert.observation}\n\nPATTERN MATCH:\n${topAlert.patternMatch}\n\nINVESTIGATION SCOPE:\nInvestigate root cause. Document findings, attach sensor logs or inspection photos, and determine whether a Work Order should be raised.`,
    issueSummary: topAlert.observation.slice(0, 200),
    evidence: [
      `Active ${topAlert.severity} severity alert (Confidence: ${topAlert.confidenceScore}%)`,
      `Time to failure: ${topAlert.timeToFailureMin}–${topAlert.timeToFailureMax} days`,
      `Pattern: ${topAlert.patternMatch.slice(0, 80)}`,
      `Financial risk: ${topAlert.financialImpactUsd >= 1_000_000 ? '$' + (topAlert.financialImpactUsd / 1_000_000).toFixed(1) + 'M' : '$' + (topAlert.financialImpactUsd / 1000).toFixed(0) + 'K'}`,
    ],
    recommendedTeam: 'Maintenance Reliability Team',
    suggestedDueDate: daysFromAnchor(1),
    sourceAlertId: topAlert.id,
  }

  return {
    sections: [
      { type: 'h2', text: 'Case Preview' },
      { type: 'p', text: 'Review the case details below. Click Create Case to save it to the system.' },
      { type: 'case-preview', preview },
    ],
    sources: [
      { type: 'asset', label: 'Asset Record', count: 1, details: targetAsset.name },
      { type: 'alert', label: 'Active Alerts', count: assetAlerts.length },
      { type: 'sensor', label: 'Sensor Readings', count: targetAsset.sensors.length },
    ],
    confidence: 'high',
    missingInfo: [],
    reasoning: `The assistant retrieved the ${targetAsset.name} asset record, reviewed the active alert, and prepared a case investigation template based on the observed fault pattern.`,
    suggestedFollowUps: [`Why is ${targetAsset.name} marked as high risk?`, 'What maintenance actions are overdue?'],
    thinkingLabels: thinkingFor('create-case'),
  }
}

function handleMaintenanceOverdue(ctx: SystemContext): AIResponse {
  const overdueWOs = ctx.workOrders.filter(w =>
    w.type === 'work-order' &&
    w.status !== 'completed' &&
    w.status !== 'cancelled' &&
    w.targetDate &&
    w.targetDate < new Date(DATA_ANCHOR).toISOString().slice(0, 10)
  )

  const openWOs = ctx.workOrders.filter(w =>
    w.type === 'work-order' &&
    (w.status === 'confirmed' || w.status === 'in_progress')
  ).slice(0, 6)

  const items = overdueWOs.length > 0 ? overdueWOs : openWOs

  const sections: Section[] = [
    { type: 'h2', text: 'Maintenance Actions Requiring Attention' },
    { type: 'p', text: items.length === 0 ? 'No overdue maintenance items found in the work order register.' : `${items.length} work order${items.length !== 1 ? 's' : ''} ${overdueWOs.length > 0 ? 'are overdue' : 'are open and require action'}.` },
    { type: 'divider' },
    { type: 'h3', text: overdueWOs.length > 0 ? 'Overdue Items' : 'Open Work Orders' },
  ]

  if (items.length > 0) {
    sections.push({
      type: 'kv',
      pairs: items.slice(0, 5).map(w => ({
        key: w.assetName,
        value: w.title.slice(0, 55) + (w.title.length > 55 ? '…' : ''),
        badge: { text: w.priority.toUpperCase(), color: prioColor(w.priority) },
      })),
    })

    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Risk Level' })
    sections.push({
      type: 'badge-row',
      badges: [
        { text: `${items.filter(w => w.priority === 'emergency').length} Emergency`, color: 'red' },
        { text: `${items.filter(w => w.priority === 'high').length} High`, color: 'orange' },
        { text: `${items.filter(w => w.priority === 'medium').length} Medium`, color: 'amber' },
        { text: `${items.filter(w => w.priority === 'low').length} Low`, color: 'blue' },
      ],
    })

    sections.push({ type: 'divider' })
    sections.push({ type: 'h3', text: 'Recommended Action' })
    sections.push({
      type: 'ul',
      items: [
        'Prioritise emergency and high priority items for immediate scheduling',
        'Assign available engineers to open work orders',
        'Review any items with assets showing active alerts — these are highest risk',
        'Update work order status in the system as work progresses',
      ],
    })
  }

  return {
    sections,
    sources: [
      { type: 'workOrder', label: 'Work Order Register', count: ctx.workOrders.length, details: `${items.length} open/overdue` },
      { type: 'asset', label: 'Asset Register', count: ctx.assets.length },
    ],
    confidence: items.length > 0 ? 'high' : 'medium',
    missingInfo: ['Preventive maintenance schedule not connected in mock mode', 'Inspection certification records not available'],
    reasoning: 'The assistant reviewed the work order register and filtered for open and overdue items, sorted by priority and asset criticality.',
    suggestedFollowUps: [
      'Which overdue item should be handled first?',
      'Create a work order for the top priority maintenance item',
      'Which assets require attention today?',
    ],
    thinkingLabels: thinkingFor('maintenance-overdue'),
  }
}

function handleMaintenancePriority(ctx: SystemContext): AIResponse {
  const openWOs = ctx.workOrders.filter(w =>
    w.type === 'work-order' && (w.status === 'confirmed' || w.status === 'in_progress')
  )

  const ranked = openWOs.sort((a, b) => {
    const pOrder = { emergency: 0, high: 1, medium: 2, low: 3 }
    return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3)
  })

  const top = ranked[0]
  const topAsset = top ? ctx.assets.find(a => a.id === top.assetId) : null
  const topAlerts = top ? ctx.alerts.filter(a => a.assetId === top.assetId) : []

  if (!top) {
    return {
      sections: [{ type: 'insufficient', message: 'No open work orders found to rank. The maintenance register appears clear.' }],
      sources: [],
      confidence: 'medium',
      missingInfo: [],
      reasoning: 'No open work orders found.',
      suggestedFollowUps: ['What maintenance actions are overdue?', 'Which assets require attention today?'],
      thinkingLabels: thinkingFor('maintenance-priority'),
    }
  }

  const sections: Section[] = [
    { type: 'h2', text: 'Recommended Maintenance Priority' },
    { type: 'h3', text: 'Top Priority Item' },
    {
      type: 'kv',
      pairs: [
        { key: 'Asset', value: top.assetName },
        { key: 'Work Order', value: top.title.slice(0, 60) },
        { key: 'Priority', value: top.priority.toUpperCase(), badge: { text: top.priority.toUpperCase(), color: prioColor(top.priority) } },
        { key: 'Status', value: top.status.replace('_', ' ').toUpperCase() },
        ...(top.targetDate ? [{ key: 'Target Date', value: top.targetDate }] : []),
        ...(top.assignedTo ? [{ key: 'Assigned To', value: top.assignedTo }] : []),
      ],
    },
    { type: 'divider' },
    { type: 'h3', text: 'Reason for Priority' },
    { type: 'ul', items: [
      `Classified as ${top.priority} priority in work order register`,
      topAlerts.length > 0 ? `${topAlerts.length} active alert${topAlerts.length !== 1 ? 's' : ''} linked to ${top.assetName}` : `No active alerts on ${top.assetName} — preventive action recommended`,
      topAsset ? `Asset health score: ${topAsset.healthScore}%` : 'Asset health data reviewed',
      'Deferred action increases risk of unplanned downtime',
    ]},
    { type: 'divider' },
    { type: 'h3', text: 'Operational Risk' },
    { type: 'p', text: topAlerts[0]?.riskIfIgnored ?? `Failure to complete this maintenance item on ${top.assetName} may result in unplanned downtime and increased repair costs.` },
  ]

  return {
    sections,
    sources: [
      { type: 'workOrder', label: 'Work Order Register', count: ctx.workOrders.length },
      { type: 'asset', label: 'Asset Record', count: 1, details: top.assetName },
      { type: 'alert', label: 'Active Alerts', count: topAlerts.length },
    ],
    confidence: 'high',
    missingInfo: ['Maintenance cost data not available in mock mode'],
    reasoning: 'Work orders were ranked by priority level and cross-referenced with active alerts and asset health scores to identify the highest-risk item for immediate action.',
    suggestedFollowUps: [
      `Create a work order for ${top.assetName}`,
      `Why is ${top.assetName} at risk?`,
      'Which assets require attention today?',
    ],
    thinkingLabels: thinkingFor('maintenance-priority'),
  }
}

function handleCreateWorkOrder(message: string, ctx: SystemContext): AIResponse {
  const asset = extractAsset(message, ctx.assets)
  const openWOs = ctx.workOrders.filter(w =>
    w.type === 'work-order' && (w.status === 'confirmed' || w.status === 'in_progress')
  ).sort((a, b) => {
    const pOrder = { emergency: 0, high: 1, medium: 2, low: 3 }
    return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3)
  })

  const refWO = openWOs[0]
  const targetAsset = asset ?? (refWO ? ctx.assets.find(a => a.id === refWO.assetId) : null)
  const targetAlerts = targetAsset ? ctx.alerts.filter(a => a.assetId === targetAsset.id) : []

  if (!targetAsset) {
    return {
      sections: [{ type: 'insufficient', message: 'I could not identify an asset to create a work order for. Please specify an asset name or ask "What maintenance is overdue?" first.' }],
      sources: [],
      confidence: 'insufficient',
      missingInfo: ['Asset name not provided'],
      reasoning: 'No asset identified for work order creation.',
      suggestedFollowUps: ['What maintenance actions are overdue?', 'Which assets require attention today?'],
      thinkingLabels: thinkingFor('create-work-order'),
    }
  }

  const preview: WorkOrderPreview = {
    title: `Inspect and service ${targetAsset.name} — ${refWO?.title.split(' ').slice(0, 4).join(' ') ?? 'Preventive Maintenance'}`,
    assetName: targetAsset.name,
    assetId: targetAsset.id,
    linkedWell: targetAsset.associatedWell,
    priority: refWO?.priority ?? (targetAlerts[0]?.severity === 'critical' ? 'emergency' : 'high'),
    maintenanceType: 'Preventive Maintenance',
    description: `Inspect and service ${targetAsset.name}. Check all critical components, verify sensor calibration, and complete scheduled maintenance tasks. Document all findings in the maintenance log.`,
    issueSummary: targetAlerts[0]?.observation ?? `${targetAsset.name} requires scheduled maintenance. Asset health score is ${targetAsset.healthScore}%.`,
    taskList: [
      `Inspect ${targetAsset.name} seals and gaskets`,
      'Check bearing condition and lubrication levels',
      'Review vibration and temperature readings',
      'Verify sensor calibration against baseline values',
      'Perform pressure and flow rate checks',
      'Update maintenance log with all findings',
    ],
    requiredTeam: 'Maintenance Reliability Team',
    suggestedDueDate: daysFromAnchor(2),
  }

  return {
    sections: [
      { type: 'h2', text: 'Work Order Preview' },
      { type: 'p', text: 'Review the work order details below. Click Create Work Order to save it to the system.' },
      { type: 'work-order-preview', preview },
    ],
    sources: [
      { type: 'asset', label: 'Asset Record', count: 1, details: targetAsset.name },
      { type: 'workOrder', label: 'Work Order Register', count: ctx.workOrders.length },
      { type: 'alert', label: 'Active Alerts', count: targetAlerts.length },
      { type: 'maintenance', label: 'Maintenance History', count: ctx.workOrders.filter(w => w.status === 'completed' && w.assetId === targetAsset.id).length },
    ],
    confidence: 'high',
    missingInfo: [],
    reasoning: `The assistant retrieved the ${targetAsset.name} asset record, reviewed the maintenance history, and prepared a preventive maintenance work order based on the asset's current status and open work items.`,
    suggestedFollowUps: [`Why is ${targetAsset.name} at risk?`, 'Which assets require attention today?'],
    thinkingLabels: thinkingFor('create-work-order'),
  }
}

function handleFleetHealth(ctx: SystemContext): AIResponse {
  const criticalCount = ctx.assets.filter(a => a.status === 'critical').length
  const degradedCount = ctx.assets.filter(a => a.status === 'degraded').length
  const healthyCount = ctx.assets.filter(a => a.status === 'healthy').length
  const avgHealth = Math.round(ctx.assets.reduce((sum, a) => sum + a.healthScore, 0) / Math.max(ctx.assets.length, 1))
  const criticalAlerts = ctx.alerts.filter(a => a.severity === 'critical').length
  const highAlerts = ctx.alerts.filter(a => a.severity === 'high').length

  return {
    sections: [
      { type: 'h2', text: 'Fleet Health Summary' },
      { type: 'kv', pairs: [
        { key: 'Fleet Average Health', value: `${avgHealth}%`, badge: { text: avgHealth >= 80 ? 'GOOD' : avgHealth >= 60 ? 'MODERATE' : 'POOR', color: avgHealth >= 80 ? 'green' : avgHealth >= 60 ? 'amber' : 'red' } },
        { key: 'Total Assets Monitored', value: `${ctx.assets.length}` },
        { key: 'Critical Status', value: `${criticalCount} asset${criticalCount !== 1 ? 's' : ''}`, badge: criticalCount > 0 ? { text: 'ACTION REQUIRED', color: 'red' } : undefined },
        { key: 'Degraded Status', value: `${degradedCount} asset${degradedCount !== 1 ? 's' : ''}`, badge: degradedCount > 0 ? { text: 'MONITOR', color: 'amber' } : undefined },
        { key: 'Healthy Status', value: `${healthyCount} asset${healthyCount !== 1 ? 's' : ''}` },
      ]},
      { type: 'divider' },
      { type: 'h3', text: 'Active Alert Distribution' },
      { type: 'badge-row', badges: [
        { text: `${criticalAlerts} Critical`, color: 'red' },
        { text: `${highAlerts} High`, color: 'orange' },
        { text: `${ctx.alerts.filter(a => a.severity === 'medium').length} Medium`, color: 'amber' },
        { text: `${ctx.alerts.filter(a => a.severity === 'low').length} Low`, color: 'blue' },
      ]},
      { type: 'divider' },
      { type: 'h3', text: 'Assets by Health Score' },
      { type: 'kv', pairs: ctx.assets.sort((a, b) => a.healthScore - b.healthScore).slice(0, 5).map(a => ({
        key: a.name,
        value: `${a.healthScore}%`,
        badge: { text: a.status.toUpperCase(), color: a.status === 'critical' ? 'red' : a.status === 'degraded' ? 'orange' : 'green' },
      }))},
    ],
    sources: [
      { type: 'asset', label: 'Asset Register', count: ctx.assets.length },
      { type: 'alert', label: 'Active Alerts', count: ctx.alerts.length },
      { type: 'sensor', label: 'Sensor Network', count: ctx.assets.reduce((sum, a) => sum + a.sensors.length, 0) },
    ],
    confidence: 'high',
    missingInfo: ['Real-time SCADA readings not available in mock mode'],
    reasoning: 'The assistant reviewed all asset health scores, status classifications, and the active alert queue to provide a comprehensive fleet health summary.',
    suggestedFollowUps: ['Which assets require attention today?', 'What maintenance actions are overdue?', 'Which assets have active high priority alerts?'],
    thinkingLabels: thinkingFor('fleet-health'),
  }
}

function handleDefault(ctx: SystemContext): AIResponse {
  const criticalAlerts = ctx.alerts.filter(a => a.severity === 'critical')
  return {
    sections: [
      { type: 'h2', text: 'Asset Intelligence Ready' },
      { type: 'p', text: `I have access to data across ${ctx.assets.length} monitored assets, ${ctx.alerts.length} active alerts, and ${ctx.workOrders.length} work orders. Ask me about asset health, alerts, maintenance, or use the suggestions below.` },
      { type: 'divider' },
      { type: 'h3', text: 'Current System Status' },
      { type: 'badge-row', badges: [
        { text: `${criticalAlerts.length} Critical Alerts`, color: criticalAlerts.length > 0 ? 'red' : 'slate' },
        { text: `${ctx.assets.filter(a => a.status === 'critical').length} Critical Assets`, color: 'orange' },
        { text: `${ctx.workOrders.filter(w => w.status === 'confirmed').length} Open Work Orders`, color: 'blue' },
      ]},
    ],
    sources: [
      { type: 'asset', label: 'Asset Register', count: ctx.assets.length },
      { type: 'alert', label: 'Active Alerts', count: ctx.alerts.length },
      { type: 'workOrder', label: 'Work Orders', count: ctx.workOrders.length },
    ],
    confidence: 'high',
    missingInfo: [],
    reasoning: 'General system status summarised from asset register, alert queue, and work order register.',
    suggestedFollowUps: ['Which assets require attention today?', 'What maintenance actions are overdue?', 'Summarise the fleet health'],
    thinkingLabels: thinkingFor('default'),
  }
}

// ── Main entry point ──────────────────────────────────────────────

export async function mockAsk(message: string, ctx: SystemContext): Promise<AIResponse> {
  // Simulate processing delay so thinking animation runs
  await new Promise(resolve => setTimeout(resolve, 1800 + Math.random() * 400))

  const intent = detectIntent(message)

  switch (intent) {
    case 'assets-attention':    return handleAssetsAttention(ctx)
    case 'explain-risk':        return handleExplainRisk(message, ctx)
    case 'create-case':         return handleCreateCase(message, ctx)
    case 'create-work-order':   return handleCreateWorkOrder(message, ctx)
    case 'maintenance-overdue': return handleMaintenanceOverdue(ctx)
    case 'maintenance-priority':return handleMaintenancePriority(ctx)
    case 'fleet-health':        return handleFleetHealth(ctx)
    case 'alerts-summary':      return handleAssetsAttention(ctx) // reuse
    default:                    return handleDefault(ctx)
  }
}
