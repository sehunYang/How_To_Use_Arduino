import type { Actuator } from '@/schema'

/** Seed data covering all 4 owned actuator categories (spec hardware inventory). */
export const actuators: Actuator[] = [
  {
    id: 'led',
    name: 'LED',
    category: 'passive',
    currentDrawMa: 20,
    pins: [
      { name: 'ANODE', kind: 'digital' },
      { name: 'CATHODE', kind: 'power' },
      { name: '+', kind: 'digital' },
      { name: '-', kind: 'power' },
    ],
    wokwi: {
      part: 'wokwi-led',
      pinMap: { ANODE: 'A', CATHODE: 'C', '+': 'A', '-': 'C' },
      simSupported: true,
      aliases: ['LED'],
    },
  },
  {
    id: 'buzzer',
    name: '부저',
    category: 'passive',
    currentDrawMa: 30,
    pins: [
      { name: 'SIGNAL', kind: 'digital' },
      { name: 'GND', kind: 'power' },
    ],
    wokwi: {
      part: 'wokwi-buzzer',
      pinMap: { SIGNAL: '2', GND: '1' },
      simSupported: true,
      aliases: ['BUZZER'],
    },
  },
  {
    id: 'dc-motor-driver',
    name: 'DC모터 + 모터드라이버',
    category: 'motor',
    currentDrawMa: 700,
    // An L298N-class dual H-bridge needs TWO direction inputs per motor
    // (IN1+IN2 for channel A, IN3+IN4 for channel B). Modelling only one per
    // motor would leave the other input floating, which makes the direction
    // undefined on real hardware, so all four are declared here.
    pins: [
      { name: 'IN1', kind: 'digital' },
      { name: 'IN2', kind: 'digital' },
      { name: 'IN3', kind: 'digital' },
      { name: 'IN4', kind: 'digital' },
      { name: 'ENA', kind: 'digital' },
      { name: 'ENB', kind: 'digital' },
      { name: 'VM', kind: 'power' },
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
    ],
    // Wokwi has no native dual-DC H-bridge. Its A4988 is an explicit motor-
    // driver stand-in: it preserves control, enable, motor-supply and ground
    // endpoints without claiming to simulate the recipe's DC drivetrain.
    wokwi: {
      part: 'wokwi-a4988',
      pinMap: {
        IN1: 'DIR',
        IN2: 'STEP',
        IN3: 'MS2',
        IN4: 'MS3',
        ENA: 'ENABLE',
        ENB: 'MS1',
        VM: 'VMOT',
        VCC: 'VDD',
        GND: 'GND',
      },
      simSupported: false,
      aliases: ['DRIVER'],
    },
  },
  {
    id: 'servo-sg90',
    name: 'SG90 서보모터',
    category: 'motor',
    currentDrawMa: 250,
    pins: [
      { name: 'SIGNAL', kind: 'digital' },
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
    ],
    wokwi: {
      part: 'wokwi-servo',
      pinMap: { SIGNAL: 'PWM', VCC: 'V+', GND: 'GND' },
      simSupported: true,
      aliases: ['SERVO'],
    },
  },
  {
    id: 'relay-module',
    name: '릴레이 모듈',
    category: 'relay',
    currentDrawMa: 70,
    pins: [
      { name: 'IN', kind: 'digital' },
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'NC', kind: 'digital' },
      { name: 'COM', kind: 'digital' },
      { name: 'NO', kind: 'digital' },
    ],
    wokwi: {
      part: 'wokwi-relay-module',
      pinMap: { IN: 'IN', VCC: 'VCC', GND: 'GND', NC: 'NC', COM: 'COM', NO: 'NO' },
      simSupported: true,
      aliases: ['RELAY'],
    },
  },
  {
    id: 'dc-fan-5v',
    name: '5V 소형 팬',
    category: 'relay',
    currentDrawMa: 150,
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'POSITIVE', kind: 'power' },
      { name: 'NEGATIVE', kind: 'power' },
    ],
    // A resistor is the honest passive two-terminal stand-in for this load;
    // the diagram does not claim to simulate fan motion.
    wokwi: {
      part: 'wokwi-resistor',
      pinMap: { VCC: '1', GND: '2', POSITIVE: '1', NEGATIVE: '2' },
      simSupported: false,
      aliases: ['FAN'],
    },
  },
  {
    id: 'lcd1602-i2c',
    name: 'LCD1602 (I2C)',
    category: 'display',
    currentDrawMa: 20,
    pins: [
      { name: 'VCC', kind: 'power' },
      { name: 'GND', kind: 'power' },
      { name: 'SCL', kind: 'i2c' },
      { name: 'SDA', kind: 'i2c' },
    ],
    wokwi: {
      part: 'wokwi-lcd1602',
      pinMap: { VCC: 'VCC', GND: 'GND', SCL: 'SCL', SDA: 'SDA' },
      simSupported: true,
      aliases: ['LCD', 'LCD1602'],
    },
  },
]

export interface WokwiAuxiliaryPart {
  id: string
  wokwi: {
    part: string
    pinMap: Record<string, string>
    simSupported: false
    aliases: string[]
  }
}

/**
 * Recipe-only supplies and loads that are not owned actuators. Wokwi does
 * not provide battery/solar-panel parts, so variable voltage sources use the
 * real potentiometer part and passive loads use the real resistor/LED parts.
 * The student-facing renderer replaces battery aliases with owned artwork,
 * while committed Wokwi projects retain a simulator-supported part.
 */
export const wokwiAuxiliaryParts: WokwiAuxiliaryPart[] = [
  {
    id: 'resistor',
    wokwi: {
      part: 'wokwi-resistor',
      pinMap: { '1': '1', '2': '2', POSITIVE: '1', NEGATIVE: '2' },
      simSupported: false,
      aliases: ['RESISTOR'],
    },
  },
  {
    id: 'panel',
    wokwi: {
      part: 'wokwi-potentiometer',
      pinMap: { POSITIVE: 'SIG', NEGATIVE: 'GND' },
      simSupported: false,
      aliases: ['PANEL'],
    },
  },
  {
    id: 'load',
    wokwi: {
      part: 'wokwi-resistor',
      pinMap: { POSITIVE: '1', NEGATIVE: '2', '+': '1', '-': '2' },
      simSupported: false,
      aliases: ['LOAD', 'LAMP'],
    },
  },
  {
    id: 'cds-resistor',
    wokwi: {
      part: 'wokwi-resistor',
      pinMap: { '1': '1', '2': '2' },
      simSupported: false,
      aliases: ['CDS_RESISTOR'],
      // 이 토큰의 접미사는 저항값이 아니라 좌우 분압기 번호(CDS_RESISTOR_1/_2)라
      // 값을 여기에 둔다. 모든 CDS 레시피가 10 kΩ 분압을 지시한다.
      attrs: { value: '10000' },
    },
  },
  {
    id: 'capacitor',
    wokwi: {
      part: 'visual-capacitor',
      pinMap: { '1': '1', '2': '2', POSITIVE: '1', NEGATIVE: '2' },
      simSupported: false,
      aliases: ['CAPACITOR'],
    },
  },
  {
    id: 'battery',
    wokwi: {
      part: 'wokwi-slide-potentiometer',
      pinMap: { '+': 'SIG', '-': 'GND' },
      simSupported: false,
      aliases: ['BATTERY', 'SERVO_SUPPLY', 'LED_SUPPLY', 'LAMP_SUPPLY', 'FAN_SUPPLY'],
    },
  },
]
