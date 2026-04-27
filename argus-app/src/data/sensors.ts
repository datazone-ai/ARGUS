import type { SensorReading } from '../types'

export function generateHistory(
  baseline: number,
  days: number,
  drift: number = 0,
  noise: number = 0.5
): SensorReading[] {
  const readings: SensorReading[] = []
  const now = new Date('2024-12-31T23:00:00Z')
  const points = days * 24

  for (let i = points; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 60 * 60 * 1000)
    const driftEffect = drift * ((points - i) / points)
    const noiseVal = (Math.random() - 0.5) * noise * 2
    readings.push({
      timestamp: ts.toISOString(),
      value: parseFloat((baseline + driftEffect + noiseVal).toFixed(2)),
    })
  }
  return readings
}

export function generateVibrationHistory(
  baseline: number,
  days: number,
  worsening: boolean = false
): SensorReading[] {
  const readings: SensorReading[] = []
  const now = new Date('2024-12-31T23:00:00Z')
  const points = days * 24

  for (let i = points; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 60 * 60 * 1000)
    const age = (points - i) / points
    const drift = worsening ? age * baseline * 0.45 : 0
    const noise = (Math.random() - 0.5) * baseline * 0.12
    const spike = Math.random() < 0.03 ? baseline * 0.3 : 0
    readings.push({
      timestamp: ts.toISOString(),
      value: parseFloat(Math.max(0, baseline + drift + noise + spike).toFixed(3)),
    })
  }
  return readings
}
