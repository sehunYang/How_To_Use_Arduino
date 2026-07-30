import { contactTroubleshooting, createProjectRecipe, i2cTroubleshooting, type Connection } from './shared'
import { p4Sketch } from './sketches'

const connections: Connection[] = [
  { from: 'MPU6050.VCC', to: 'UNO.5V', color: 'red', text: 'MPU6050 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'MPU6050.GND', to: 'UNO.GND', color: 'black', text: 'MPU6050 GND를 아두이노 GND에 연결하세요.' },
  { from: 'MPU6050.SDA', to: 'UNO.A4', color: 'green', text: 'MPU6050 SDA를 아두이노 A4에 연결하세요.' },
  { from: 'MPU6050.SCL', to: 'UNO.A5', color: 'yellow', text: 'MPU6050 SCL을 아두이노 A5에 연결하세요.' },
  { from: 'HC-SR04.VCC', to: 'UNO.5V', color: 'red', text: 'HC-SR04 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'HC-SR04.GND', to: 'UNO.GND', color: 'black', text: 'HC-SR04 GND를 아두이노 GND에 연결하세요.' },
  { from: 'HC-SR04.TRIG', to: 'UNO.D9', color: 'orange', text: 'HC-SR04 TRIG를 아두이노 D9에 연결하세요.' },
  { from: 'HC-SR04.ECHO', to: 'UNO.D10', color: 'blue', text: 'HC-SR04 ECHO를 아두이노 D10에 연결하세요.' },
]

export const p4Recipe = createProjectRecipe({
  id: 'p4-friction-energy-loss',
  title: '마찰에 의한 에너지 손실 측정',
  subject: '물리',
  difficulty: '고급',
  minutes: 80,
  sensors: ['mpu6050', 'hc-sr04'],
  coreKeywords: ['마찰', '에너지 손실', '수레', '거리', '가속도'],
  connections,
  sketch: p4Sketch,
  tunable: { anchor: 'samplingIntervalMs', name: '측정 간격 (ms)', hint: '초음파 센서의 잔향을 피하도록 60 ms 이상으로 유지하세요.' },
  overview: '수레의 거리와 가속도를 함께 기록해 출발할 때의 위치에너지 중 운동에너지로 남지 않은 양을 추정합니다.',
  procedure: '경사각과 수레 질량을 재고 HC-SR04를 진행 방향 뒤쪽에 고정하세요. 같은 출발점에서 반복하고, 거리 미분으로 얻은 속도와 MPU6050 가속도의 경향이 일치하는지 확인하세요.',
  science: '손실 에너지는 초기 위치에너지에서 최종 운동에너지를 뺀 값으로 추정합니다. 바퀴 회전 에너지, 공기 저항, 초음파 사각과 센서 질량도 에너지 장부에 영향을 줍니다.',
  applicationGuide: '표면 재질이나 수레 하중을 바꾸어 이동 거리당 손실 에너지와 유효 마찰력을 비교하세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: '거리와 가속도 변화 시점이 맞지 않음', cause: '두 센서의 측정 지연과 시리얼 기록 시점이 다릅니다.', fix: '각 행의 millis()를 기준으로 자료를 정렬하고 초음파 이상점을 제거하세요.' },
  ],
})
