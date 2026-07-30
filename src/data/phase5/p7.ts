import { contactTroubleshooting, createProjectRecipe, i2cTroubleshooting, type Connection } from './shared'
import { p7Sketch } from './sketches'

const connections: Connection[] = [
  { from: 'INA219.VCC', to: 'UNO.5V', color: 'red', text: 'INA219 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'INA219.GND', to: 'UNO.GND', color: 'black', text: 'INA219 GND를 아두이노 GND에 연결하세요.' },
  { from: 'INA219.SDA', to: 'UNO.A4', color: 'green', text: 'INA219 SDA를 아두이노 A4에 연결하세요.' },
  { from: 'INA219.SCL', to: 'UNO.A5', color: 'yellow', text: 'INA219 SCL을 아두이노 A5에 연결하세요.' },
  { from: 'TSL2591.VCC', to: 'UNO.5V', color: 'red', text: 'TSL2591 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'TSL2591.GND', to: 'UNO.GND', color: 'black', text: 'TSL2591 GND를 아두이노 GND에 연결하세요.' },
  { from: 'TSL2591.SDA', to: 'UNO.A4', color: 'green', text: 'TSL2591 SDA를 아두이노 A4 I2C 버스에 함께 연결하세요.' },
  { from: 'TSL2591.SCL', to: 'UNO.A5', color: 'yellow', text: 'TSL2591 SCL을 아두이노 A5 I2C 버스에 함께 연결하세요.' },
  { from: 'PANEL.POSITIVE', to: 'LOAD.POSITIVE', color: 'orange', text: 'Wokwi에서는 태양광 패널 stand-in 출력을 실험용 부하에 연결하세요.' },
  { from: 'PANEL.NEGATIVE', to: 'LOAD.NEGATIVE', color: 'purple', text: '패널과 부하의 음극을 연결하세요. INA219 전류값은 시나리오 입력으로 제공합니다.' },
]

export const p7Recipe = createProjectRecipe({
  id: 'p7-solar-panel-angle',
  title: '태양광 패널 각도별 효율',
  subject: '물리',
  difficulty: '고급',
  minutes: 80,
  sensors: ['ina219', 'tsl2591'],
  coreKeywords: ['태양광', '패널', '효율', '전력', '입사각', '조도'],
  connections,
  sketch: p7Sketch,
  tunable: { anchor: 'panelAreaCm2', name: '패널 면적 (cm²)', hint: '빛을 받는 유효 면적을 자로 재어 입력하세요.' },
  overview: '광원에 대한 패널 각도를 바꾸며 INA219의 전기 출력과 TSL2591의 입사 광량을 동시에 기록합니다.',
  procedure: '광원-패널 거리와 부하를 고정하고 패널 법선과 광선 사이 각도를 일정 간격으로 바꾸세요. 각 각도에서 값이 안정된 뒤 전압×전류를 구하고 광량도 함께 기록하세요.',
  science: '평행광이 평면에 주는 복사 에너지는 이상적으로 cosθ에 비례합니다. 전기 효율은 출력 전력/입사 전력이며, 조도(lux)는 사람 눈 가중치라 복사조도(W/m²)의 완전한 대체값은 아닙니다.',
  applicationGuide: '패널 3장을 동시에 비교하려면 INA219 A0·A1 점퍼를 납땜해 주소를 다르게 하거나, 납땜이 어려우면 TCA9548A를 쓰세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: '전압은 보이지만 전류가 0에 가까움', cause: '부하가 연결되지 않았거나 INA219의 VIN+와 VIN-가 측정 경로에 직렬로 들어가지 않았습니다.', fix: '패널-INA219-부하가 직렬인지 확인하고 패널 허용 범위 안의 부하를 사용하세요.' },
  ],
})
