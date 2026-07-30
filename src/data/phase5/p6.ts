import { contactTroubleshooting, createProjectRecipe, poweredAnalogConnections } from './shared'
import { p6Sketch } from './sketches'

export const p6Recipe = createProjectRecipe({
  id: 'p6-magnetic-field-distance',
  title: '자석의 거리에 따른 자기장 감쇠',
  subject: '물리',
  difficulty: '중급',
  minutes: 50,
  sensors: ['hbe0704'],
  coreKeywords: ['자기장', '홀 센서', '자석', '거리', '극성'],
  connections: poweredAnalogConnections('HBE0704'),
  sketch: p6Sketch,
  tunable: { anchor: 'zeroAdc', name: '영점 ADC', hint: '자석을 멀리 치운 상태에서 100회 평균한 값을 입력하세요.' },
  overview: '홀 센서의 영점 대비 출력 변화로 자석 축 방향 자기장의 세기와 극성을 거리별로 비교합니다.',
  procedure: '센서와 자석의 중심축을 맞추고 비자성 자로 거리를 재세요. 자석이 없을 때 영점을 기록한 뒤 같은 극 방향을 유지하며 거리를 늘려 각 지점에서 평균값을 구하세요.',
  science: '자석에서 충분히 멀면 쌍극자 축 자기장은 대략 거리의 세제곱에 반비례합니다. 가까운 거리에서는 자석 크기를 점으로 볼 수 없고 센서가 포화될 수 있어 단순 법칙이 맞지 않습니다.',
  applicationGuide: '로그-로그 그래프의 기울기를 구하고 가까운 점을 제외할 때 -3에 가까워지는지 확인해보세요.',
  troubleshooting: [
    contactTroubleshooting,
    { symptom: '자석을 뒤집어도 값의 부호가 바뀌지 않음', cause: '영점 설정이 틀렸거나 센서의 민감축과 자석 축이 어긋났습니다.', fix: '자석을 치우고 zeroAdc를 다시 정한 뒤 센서 면에 수직으로 N극과 S극을 번갈아 대세요.' },
  ],
})
