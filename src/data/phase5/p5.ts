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
  overview: '수레에 고정한 MPU6050으로 경사면 방향 가속도와 정지 상태의 기울기를 측정합니다.',
  procedure: '센서 x축을 진행 방향과 맞추고 정지 상태에서 경사각을 기록하세요. 수레를 밀지 않고 놓아 일정한 가속도 구간의 평균을 구하고 각 각도에서 세 번 반복하세요.',
  science: '마찰이 없으면 경사면 방향 가속도는 $g\\sin\\theta$입니다. 실제 수레에서는 구름 마찰과 센서 축이 운동 방향에서 어긋난 영향 때문에 작아지며, 정지 시 중력 성분과 운동 중 관성 성분을 구분해야 합니다.',
  applicationGuide: '$\\sin\\theta$를 가로축, 측정 가속도를 세로축으로 그려 기울기와 절편에서 $g$와 마찰 효과를 추정하세요.',
  troubleshooting: [i2cTroubleshooting, contactTroubleshooting],
})
