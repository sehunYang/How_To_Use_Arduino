import { useEffect, useState } from 'react'
import { sensors as bundledSensors } from '@/data/inventory-seed/sensors'
import { SensorSchema, type Sensor } from '@/schema'
import { ensureAppCheck, getClientApp } from './clientApp'

export function parseSensorInventory(records: unknown[]): Sensor[] {
  return records.map((record) => SensorSchema.parse(record))
}

/**
 * Reads the public Firestore inventory while retaining the validated bundled
 * seed for offline use and deployments without Firebase configuration.
 */
export async function loadSensorInventory(): Promise<Sensor[]> {
  const app = await getClientApp()
  if (!app || !(await ensureAppCheck(app))) return bundledSensors
  const { collection, getDocs, getFirestore } = await import('firebase/firestore')
  const snapshot = await getDocs(collection(getFirestore(app), 'sensors'))
  if (snapshot.empty) return bundledSensors
  return parseSensorInventory(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })))
}

export function useSensorInventory(): Sensor[] {
  const [sensors, setSensors] = useState<Sensor[]>(bundledSensors)

  useEffect(() => {
    let active = true
    void loadSensorInventory()
      .then((loaded) => {
        if (active) setSensors(loaded)
      })
      .catch(() => {
        // The bundled, schema-validated inventory remains usable offline.
      })
    return () => {
      active = false
    }
  }, [])

  return sensors
}
