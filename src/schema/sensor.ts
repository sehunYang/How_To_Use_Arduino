import { z } from 'zod'

/**
 * Addressing is declarative (plan 1.2 / N3), not code, so the L1 I2C
 * conflict check and the diagram.json generator both stay generic — a new
 * sensor never requires a code change (A6.1).
 */
export const AddressingFixedSchema = z.object({
  mode: z.literal('fixed'),
  addresses: z.array(z.string().min(1)).min(1),
  maxOnBus: z.number().int().positive(),
})

export const AddressingStrappedSchema = z.object({
  mode: z.literal('strapped'),
  addresses: z.array(z.string().min(1)).min(1),
  strapPins: z.array(z.string().min(1)).min(1),
  maxOnBus: z.number().int().positive(),
})

export const AddressingOnewireSchema = z.object({
  mode: z.literal('onewire'),
  maxOnBus: z.number().int().positive(),
})

export const AddressingNoneSchema = z.object({
  mode: z.literal('none'),
})

export const AddressingSchema = z.discriminatedUnion('mode', [
  AddressingFixedSchema,
  AddressingStrappedSchema,
  AddressingOnewireSchema,
  AddressingNoneSchema,
])
export type Addressing = z.infer<typeof AddressingSchema>

export const SensorPinSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['digital', 'analog', 'power', 'i2c']),
})
export type SensorPin = z.infer<typeof SensorPinSchema>

/**
 * Wokwi simulation descriptor lives on the sensor record (plan N3), not in
 * a code generator, so registering an 11th sensor never requires editing
 * the diagram.json generator.
 */
export const WokwiDescriptorSchema = z.object({
  part: z.string().min(1),
  pinMap: z.record(z.string(), z.string()),
  simSupported: z.boolean(),
})
export type WokwiDescriptor = z.infer<typeof WokwiDescriptorSchema>

export const SensorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  interface: z.enum(['digital', 'analog', 'i2c', 'onewire']),
  addressing: AddressingSchema,
  pins: z.array(SensorPinSchema),
  currentDrawMa: z.number().nonnegative(),
  wokwi: WokwiDescriptorSchema,
  /**
   * Number of downstream I2C channels this part provides for OTHER sensors
   * (0 for every ordinary sensor; e.g. 8 for TCA9548A). Declarative so the
   * L1 address-conflict check stays data-driven — flagging a specific part
   * id in code would break A6.1 for the next multiplexer added (plan N3/F3).
   */
  muxChannels: z.number().int().nonnegative().default(0),
})
export type Sensor = z.infer<typeof SensorSchema>

export const ActuatorCategorySchema = z.enum(['passive', 'motor', 'relay', 'display'])
export type ActuatorCategory = z.infer<typeof ActuatorCategorySchema>

export const ActuatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: ActuatorCategorySchema,
  currentDrawMa: z.number().nonnegative(),
  pins: z.array(SensorPinSchema),
})
export type Actuator = z.infer<typeof ActuatorSchema>
