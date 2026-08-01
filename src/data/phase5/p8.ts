import { contactTroubleshooting, createProjectRecipe, i2cTroubleshooting, type Connection } from './shared'
import { p8Sketch } from './sketches'

const connections: Connection[] = [
  { from: 'TSL2591.VIN', to: 'UNO.5V', color: 'red', text: 'TSL2591 VIN을 아두이노 5V에 연결하세요.' },
  { from: 'TSL2591.GND', to: 'UNO.GND', color: 'black', text: 'TSL2591 GND를 아두이노 GND에 연결하세요.' },
  { from: 'TSL2591.SDA', to: 'UNO.A4', color: 'green', text: 'TSL2591 SDA를 아두이노 A4에 연결하세요.' },
  { from: 'TSL2591.SCL', to: 'UNO.A5', color: 'yellow', text: 'TSL2591 SCL을 아두이노 A5에 연결하세요.' },
  { from: 'HC-SR04.VCC', to: 'UNO.5V', color: 'red', text: 'HC-SR04 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'HC-SR04.GND', to: 'UNO.GND', color: 'black', text: 'HC-SR04 GND를 아두이노 GND에 연결하세요.' },
  { from: 'HC-SR04.TRIG', to: 'UNO.D9', color: 'orange', text: 'HC-SR04 TRIG를 아두이노 D9에 연결하세요.' },
  { from: 'HC-SR04.ECHO', to: 'UNO.D10', color: 'blue', text: 'HC-SR04 ECHO를 아두이노 D10에 연결하세요.' },
]

export const p8Recipe = createProjectRecipe({
  id: 'p8-inverse-square-light',
  title: '거리에 따른 빛의 세기 (역제곱 법칙)',
  subject: '물리',
  difficulty: '중급',
  minutes: 60,
  sensors: ['tsl2591', 'hc-sr04'],
  coreKeywords: ['빛의 세기', '역제곱 법칙', '거리', '조도', '점광원'],
  connections,
  sketch: p8Sketch,
  tunable: { anchor: 'sampleCount', name: '지점별 평균 횟수', hint: '흔들리는 값은 5~20회 평균하되 광원과 센서는 움직이지 마세요.' },
  overview: '초음파로 광원과 센서 사이 거리를 재고 같은 시점의 조도를 기록해 역제곱 관계를 확인합니다.',
  procedure: '주변광을 먼저 재고 각 조도값에서 빼세요. 광원 중심과 TSL2591 수광면을 같은 축에 수직으로 맞추고, 광원 필라멘트와 같은 평면에 평평한 카드를 세워 초음파 반사판으로 쓰세요. 전구 유리면처럼 굽은 면은 초음파 표적으로 부적합합니다. 거리를 충분히 넓은 범위에서 바꾸세요.',
  science: '모든 방향으로 똑같이 빛을 내는 매우 작은 광원은 에너지가 구면에 퍼져 세기가 $1/r^2$에 비례합니다. 가까운 거리에서는 광원의 실제 크기, 반사광, 센서 측정 범위 초과, 초음파 영점 거리가 이 관계를 왜곡합니다.',
  applicationGuide: '보정한 조도×거리$^2$가 일정한지 표로 확인하고, 로그-로그 그래프 기울기가 $-2$에 가까운지 비교하세요.',
  troubleshooting: [i2cTroubleshooting, contactTroubleshooting],
})
