import { computeInventoryVersion } from '@/lib/verifyHash'
import { actuators } from './actuators'
import { sensors } from './sensors'

/** Current content-derived version used by recipe verification hashes. */
export const INVENTORY_VERSION = computeInventoryVersion({ sensors, actuators })
