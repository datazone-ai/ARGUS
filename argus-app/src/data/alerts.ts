import type { Alert } from '../types'

export const ALERTS: Alert[] = [
  {
    id: 'ALT-001',
    assetId: 'COMP-A',
    assetName: 'Compressor Train A',
    linkedWell: 'OML-58-07',
    severity: 'critical',
    type: 'predictive',
    title: 'NDE Bearing Thermal Degradation — Imminent Failure Risk',
    observation:
      'Bearing temperature NDE has risen 4.8°C over 11 days (current: 74.2°C, baseline: 69.4°C). Discharge temperature delta is also +3.1°C above expected for current compression ratio (actual: 142.6°C, expected: 139.5°C). Vibration on drive end has increased from 3.2 mm/s to 5.8 mm/s over the same period — a 81% rise above baseline.',
    patternMatch:
      'Pattern matches 6 historical bearing failures in the database. In 5 of 6 cases, this combined thermal + vibration signature preceded mechanical seizure within 8–22 days.',
    recommendedAction:
      'Schedule immediate NDE bearing inspection. Check lube oil pressure (target: ≥2.8 barg) and lube oil flow rate. Verify lube oil filter differential pressure. Last bearing replacement: 14 months ago — approaching end of typical 18-month life at current load. Consider pulling from service for planned maintenance before weekend peak-load period.',
    riskIfIgnored:
      'Based on current degradation rate of 0.44°C/day, estimated failure within 8–21 days. Unplanned shutdown cost: ~$2.1M deferred production (OML-58-07: ~1,200 BOPD × 18 days average × $97/bbl). Emergency maintenance premium: est. +$340K vs. planned shutdown.',
    confidenceScore: 87,
    timeToFailureMin: 8,
    timeToFailureMax: 21,
    predictedImpactBopd: 1200,
    financialImpactUsd: 2100000,
    triggeredAt: '2024-12-31T18:30:00Z',
    status: 'open',
    sensors: ['COMP-A_BEAR_TEMP_NDE', 'COMP-A_DISC_TEMP', 'COMP-A_VIB_DE'],
  },
  {
    id: 'ALT-002',
    assetId: 'GT-A',
    assetName: 'Gas Turbine Gen A',
    linkedWell: null,
    severity: 'critical',
    type: 'predictive',
    title: 'Hot Section Degradation — Compressor Fouling Detected',
    observation:
      'Exhaust temperature has risen to 548°C, 38°C above the 510°C baseline — a 7.5% deviation. Power output has declined from 24.8 MW to 21.9 MW (-12%). Fuel gas consumption increased from 1.92 to 2.18 MMScfd (+13.5%) for the same load demand. Heat rate degradation implies thermal efficiency drop from 32.1% to 28.4%. Vibration on drive end has reached 8.9 mm/s — within 1.2% of the 9.0 mm/s shutdown threshold.',
    patternMatch:
      'Combined exhaust temp rise + fuel flow increase + power reduction pattern matches Stage 3 hot section fouling signature observed in 4 GE Frame 5 units in the database. Compressor washing campaign resolved similar degradation in 2 prior cases.',
    recommendedAction:
      'Initiate online compressor washing within 48 hours. Schedule offline wash and borescope inspection of hot section blades during next maintenance window. Reduce load to 85% rated (21 MW) to manage vibration until inspection completed. Monitor vibration 4× daily — approach to 9.0 mm/s shutdown limit warrants continuous monitoring. Last major overhaul: 18 months ago (scheduled interval: 24 months).',
    riskIfIgnored:
      'At current degradation rate, vibration shutdown threshold breach estimated within 4–9 days. Terminal failure (blade fracture) carries risk of catastrophic casing damage. Facility power loss impact: all Bonny Terminal electric submersible pumps offline — estimated $4.8M deferred production. Turbine replacement lead time: 8–14 weeks.',
    confidenceScore: 91,
    timeToFailureMin: 4,
    timeToFailureMax: 9,
    predictedImpactBopd: 2800,
    financialImpactUsd: 4800000,
    triggeredAt: '2024-12-31T14:15:00Z',
    status: 'open',
    sensors: ['GTA_EXH_TEMP', 'GTA_VIB_DE', 'GTA_POWER_OUT', 'GTA_FUEL_FLOW'],
  },
  {
    id: 'ALT-003',
    assetId: 'ESP-03',
    assetName: 'ESP Pump – Well 03',
    linkedWell: 'OML-79-03',
    severity: 'high',
    type: 'predictive',
    title: 'Motor Winding Degradation — Sand Ingestion Pattern',
    observation:
      'Motor temperature has risen 10.4°C over 30 days (current: 118.4°C, baseline: 108.0°C). Motor current has increased from 44.5 A to 47.8 A (+7.4%), indicating increased mechanical drag. Vibration signature at 4.1 mm/s shows characteristic high-frequency harmonic consistent with impeller abrasion from sand/solids ingestion. Pump intake pressure declining (892 psi vs 950 psi baseline) — potential partial blockage at intake screen.',
    patternMatch:
      'Motor temp + current increase + vibration harmonic pattern matches sand ingestion failure progression observed in 3 REDA ESP units in OML-79 block (2021–2023). In 2 of 3 cases, motor burnout followed within 18–35 days without intervention.',
    recommendedAction:
      'Reduce pump frequency from 60 Hz to 55 Hz to lower mechanical stress immediately. Increase production logging frequency to monitor sand production. Schedule wireline survey to inspect intake screen for partial blockage. Evaluate sand control options (resin-coated gravel pack). Last pull: 34 months ago.',
    riskIfIgnored:
      'Estimated motor burnout within 18–35 days if current degradation rate continues. Well OML-79-03 workover for ESP replacement: 12–18 day shutdown, estimated $1.3M lost production (780 BOPD × 16 days × $97/bbl) plus $420K ESP replacement + mobilisation costs.',
    confidenceScore: 74,
    timeToFailureMin: 18,
    timeToFailureMax: 35,
    predictedImpactBopd: 780,
    financialImpactUsd: 1720000,
    triggeredAt: '2024-12-30T09:00:00Z',
    status: 'open',
    sensors: ['ESP03_MOTOR_TEMP', 'ESP03_CURRENT', 'ESP03_VIBRATION', 'ESP03_INTAKE_PRESS'],
  },
  {
    id: 'ALT-004',
    assetId: 'PL-SEG1',
    assetName: 'Export Pipeline – Seg 1',
    linkedWell: 'Multiple',
    severity: 'high',
    type: 'anomaly',
    title: 'Pressure Differential Anomaly — Possible Third-Party Interference',
    observation:
      'Inlet-to-outlet pressure differential has increased from 13.0 to 13.7 barg over 7 days — a 5.4% rise inconsistent with normal viscosity/flow rate changes. Flow rate has declined 8.1% (118,000 → 108,400 BOPD) while inlet pressure is also falling. Pattern at km 14.2 segment matches pressure wave signature associated with pipeline perforation rather than wax/scale build-up (which shows different differential characteristics).',
    patternMatch:
      'Pressure wave attenuation pattern at Segment 1 mid-point correlates with third-party interference events documented on Bonny–Brass line in 2019 and 2022. Cathodic protection deficiency noted at km 14.2 in last CP survey (March 2024) increases external vulnerability.',
    recommendedAction:
      'Deploy aerial/UAV patrol of Segment 1 between km 12 and km 16 within 24 hours. Alert NUPRC security liaison per NAPIMS security protocol. Increase SCADA sampling rate on Segment 1 pressure transducers to 1-minute intervals. Do not reduce operating pressure until physical inspection completed — pressure reduction may exacerbate flow through any perforation point.',
    riskIfIgnored:
      'Undetected perforation could escalate to full rupture. Pipeline rupture: environmental fine exposure under NOSDRA regulations (up to $500K + remediation). Spill cleanup cost estimate: $2–8M. Production interruption on full trunkline: up to 120,000 BOPD × repair duration.',
    confidenceScore: 68,
    timeToFailureMin: 3,
    timeToFailureMax: 14,
    predictedImpactBopd: 4500,
    financialImpactUsd: 3200000,
    triggeredAt: '2024-12-31T06:00:00Z',
    status: 'open',
    sensors: ['PL1_PRESS_IN', 'PL1_PRESS_OUT', 'PL1_FLOW'],
  },
  {
    id: 'ALT-005',
    assetId: 'SEP-01',
    assetName: 'Separator Unit 1',
    linkedWell: 'OML-58-07 / OML-58-08',
    severity: 'medium',
    type: 'threshold',
    title: 'Liquid Level Control Drift — Carry-Over Risk',
    observation:
      'Vessel liquid level has drifted from 50% to 64.8% setpoint over 14 days, indicating level control valve or instrument degradation. Level oscillation amplitude has increased from ±2% to ±8%, suggesting control loop instability. Sustained high level increases risk of liquid carry-over into gas outlet — damaging downstream compressors.',
    patternMatch:
      'Level control drift pattern consistent with level control valve trim wear or instrument calibration drift. Similar behaviour observed on SEP-02 in 2023 — resolved by level valve actuator replacement and instrument recalibration.',
    recommendedAction:
      'Perform level control valve stroke test and check actuator response. Recalibrate level transmitter (LT-SEP01-001). If valve response is sluggish, schedule actuator maintenance. Increase level high-high alarm monitoring frequency. Check downstream KO drum for liquid accumulation.',
    riskIfIgnored:
      'Liquid carry-over into compressor suction: potential compressor liquid slug — catastrophic mechanical damage risk. Compressor damage repair: $800K–$1.5M + 3–6 week shutdown.',
    confidenceScore: 82,
    timeToFailureMin: 14,
    timeToFailureMax: 30,
    predictedImpactBopd: 600,
    financialImpactUsd: 900000,
    triggeredAt: '2024-12-29T11:30:00Z',
    status: 'open',
    sensors: ['SEP01_LEVEL', 'SEP01_PRESS'],
  },
  {
    id: 'ALT-006',
    assetId: 'COMP-B',
    assetName: 'Compressor Train B',
    linkedWell: 'OML-58-08',
    severity: 'low',
    type: 'predictive',
    title: 'Seal Wear — Early Indicator',
    observation:
      'Discharge temperature marginally elevated at 138.2°C vs 139.0°C baseline — within normal range but trending upward at 0.08°C/day over 10 days. Compression ratio has slightly improved, so temperature elevation is not thermodynamically explained. Suggests minor internal gas recirculation consistent with early seal wear.',
    patternMatch:
      'Early-stage seal degradation pattern. At current rate, threshold breach expected in 45–90 days. Not urgent but warrants inclusion in next scheduled maintenance planning.',
    recommendedAction:
      'Include seal inspection in next scheduled maintenance window (August 2025). No immediate action required. Continue monitoring discharge temperature trend — escalate to High if rate increases above 0.15°C/day.',
    riskIfIgnored:
      'Seal failure would require planned shutdown of 3–5 days. Estimated production impact: 480 BOPD × 4 days = $186K. Manageable if caught at next maintenance window.',
    confidenceScore: 55,
    timeToFailureMin: 45,
    timeToFailureMax: 90,
    predictedImpactBopd: 480,
    financialImpactUsd: 186000,
    triggeredAt: '2024-12-28T16:00:00Z',
    status: 'open',
    sensors: ['COMP-B_DISC_TEMP'],
  },
]

export function getAlertsByAsset(assetId: string): Alert[] {
  return ALERTS.filter(a => a.assetId === assetId)
}

export function getOpenAlerts(): Alert[] {
  return ALERTS.filter(a => a.status === 'open')
}
