import { contactTroubleshooting, createProjectRecipe, i2cConnections, i2cTroubleshooting } from './shared'
import { p1Sketch } from './sketches'

export const p1Recipe = createProjectRecipe({
  id: 'p1-pendulum-period',
  title: '단진자의 주기 측정하기',
  subject: '물리',
  difficulty: '초급',
  minutes: 50,
  sensors: ['mpu6050'],
  coreKeywords: ['단진자', '주기', '가속도', '중력', '진동'],
  connections: i2cConnections('MPU6050'),
  sketch: p1Sketch,
  tunable: { anchor: 'samplingIntervalMs', name: '측정 간격 (ms)', hint: '예상 주기의 1/20보다 짧게 설정하면 봉우리 사이 시간을 안정적으로 찾을 수 있습니다.' },
  overview: '진자에 고정한 MPU6050의 가속도 파형에서 같은 방향의 봉우리 사이 시간을 재어 주기를 구합니다.',
  procedure: '진폭을 10° 이하로 맞추고 놓은 뒤 10회 이상 왕복을 기록하세요. 연속한 여러 주기의 총 시간을 주기 수로 나누면 한 번만 잰 값보다 우연 오차가 작습니다.',
  science: '작은 각도에서 단진자의 주기는 T = 2π√(L/g)로 근사됩니다. 큰 진폭, 축 정렬 오차, 공기 저항과 회전축 마찰은 이 근사에서 벗어나게 합니다.',
  applicationGuide: '실 길이를 여러 값으로 바꾸어 T²과 L의 그래프를 그리고 기울기에서 중력가속도를 추정해보세요.',
  troubleshooting: [i2cTroubleshooting, contactTroubleshooting],
})
