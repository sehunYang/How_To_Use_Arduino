import { contactTroubleshooting, createProjectRecipe, i2cConnections, i2cTroubleshooting } from './shared'
import { p5Sketch } from './sketches'

export const p5Recipe = createProjectRecipe({
  id: 'p5-incline-acceleration',
  title: '경사면에서의 가속도',
  subject: '물리',
  difficulty: '중급',
  minutes: 55,
  sensors: ['mpu6050'],
  coreKeywords: ['경사면', '가속도', '경사각', '중력', '마찰'],
  connections: i2cConnections('MPU6050'),
  sketch: p5Sketch,
  tunable: { anchor: 'samplingIntervalMs', name: '측정 간격 (ms)', hint: '수레가 움직이는 동안 30개 이상의 점을 얻도록 조절하세요.' },
  overview: '수레에 고정한 MPU6050으로 정지 상태의 경사각과 주행 시작·도달 시각을 기록하고, 자로 잰 주행 거리와 함께 평균 가속도를 구합니다.',
  procedure: '시리얼 모니터 속도를 115200으로 맞추세요. 센서 x축을 진행 방향과 맞추고 정지 상태에서 tilt_deg로 경사각을 기록한 뒤, 출발선과 도착선 사이 거리를 자로 재어 두세요. 수레를 밀지 않고 놓아 기록에서 출발 순간과 도달 순간(스파이크)을 읽어 $a=2s/\\Delta t^2$으로 평균 가속도를 구하고, 각 각도에서 세 번 반복하세요. 굴러가는 동안 센서가 직접 읽는 가속도 값은 마찰 성분만 남으므로 그대로 가속도로 쓰지 마세요.',
  science: '마찰이 없으면 경사면 방향 가속도는 $g\\sin\\theta$입니다. 자유롭게 굴러가는 수레 위의 가속도계는 이 값을 직접 읽지 못하고 마찰 성분만 읽으므로, 가속도는 주행 거리와 시간에서 구해야 합니다. 정지 상태에서는 중력 성분이 그대로 읽혀 기울기 측정에 쓸 수 있습니다.',
  applicationGuide: '$\\sin\\theta$를 가로축, 시간·거리에서 구한 평균 가속도를 세로축으로 그려 기울기와 절편에서 $g$와 마찰 효과를 추정하세요.',
  troubleshooting: [i2cTroubleshooting, contactTroubleshooting],
})
