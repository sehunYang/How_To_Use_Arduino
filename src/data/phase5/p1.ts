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
  overview: '진자에 고정한 MPU6050의 스케치는 타임스탬프와 가속도 원시값만 CSV로 기록합니다. 같은 방향의 봉우리 사이 시간을 찾는 주기 계산은 저장한 CSV를 후처리하여 수행합니다.',
  procedure: '시리얼 모니터 속도를 115200으로 맞추세요. 센서의 x축이 실과 나란하도록 추에 단단히 붙이고, 진폭을 10° 이하로 맞추고 놓은 뒤 10회 이상 왕복의 원시 CSV를 기록하세요. 봉우리는 추가 최하점을 지날 때마다(반주기마다) 생기므로 봉우리 수의 절반이 주기 수입니다. 연속한 여러 주기의 총 시간을 주기 수로 나누면 한 번만 잰 값보다 우연 오차가 작습니다.',
  science: '작은 각도에서 단진자의 주기는 $T=2\\pi\\sqrt{L/g}$로 근사됩니다. 큰 진폭, 축 정렬 오차, 공기 저항과 회전축 마찰은 이 근사에서 벗어나게 합니다.',
  applicationGuide: '실 길이를 여러 값으로 바꾸어 $T^2$과 $L$의 그래프를 그리고 기울기에서 중력가속도를 추정해보세요.',
  troubleshooting: [i2cTroubleshooting, contactTroubleshooting],
})
