export type AssetType = 'compressor' | 'pump' | 'separator' | 'pipeline' | 'turbine'
export type AssetStatus = 'healthy' | 'degraded' | 'critical' | 'offline'
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AlertType = 'predictive' | 'threshold' | 'anomaly' | 'decline'
export type SensorStatus = 'normal' | 'warning' | 'critical' | 'stale' | 'flatline' | 'erratic'

export interface Asset {
  id: string
  name: string
  type: AssetType
  location: string
  facility: string
  associatedWell: string | null
  parentAsset: string | null
  healthScore: number
  status: AssetStatus
  manufacturer: string
  installDate: string
  lastMaintenance: string
  nextScheduledMaintenance: string
  ratedCapacity: string
  operatingHours: number
  sensors: Sensor[]
  failureModes: FailureMode[]
}

export interface Sensor {
  id: string
  name: string
  type: string
  unit: string
  currentValue: number
  baseline: number
  loAlarm: number
  hiAlarm: number
  status: SensorStatus
  lastUpdated: string
  history: SensorReading[]
}

export interface SensorReading {
  timestamp: string
  value: number
}

export interface FailureMode {
  name: string
  probability: number
  contributingFactor: string
}

export interface Alert {
  id: string
  assetId: string
  assetName: string
  linkedWell: string | null
  severity: AlertSeverity
  type: AlertType
  title: string
  observation: string
  patternMatch: string
  recommendedAction: string
  riskIfIgnored: string
  confidenceScore: number
  timeToFailureMin: number
  timeToFailureMax: number
  predictedImpactBopd: number
  financialImpactUsd: number
  triggeredAt: string
  status: 'open' | 'snoozed' | 'dismissed' | 'resolved' | 'acknowledged'
  sensors: string[]
}

export interface MaintenanceRecord {
  id: string
  assetId: string
  assetName: string
  date: string
  type: 'preventive' | 'corrective' | 'inspection' | 'overhaul'
  technician: string
  duration: number
  findings: string
  outcome: string
  nextDue: string
}

export interface HealthSnapshot {
  date: string
  score: number
}
