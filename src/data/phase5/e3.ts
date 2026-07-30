import { contactTroubleshooting, createProjectRecipe, oneWireConnections } from './shared'
import { e3Sketch } from './sketches'

export const e3Recipe = createProjectRecipe({
  id: 'cooling-curve',
  title: '물의 냉각 곡선 (뉴턴 냉각법칙)',
  subject: '화학·환경',
  difficulty: '중급',
  minutes: 70,
  sensors: ['ds18b20'],
  coreKeywords: ['냉각 곡선', '냉각', '뉴턴 냉각법칙', '뉴턴', '식는', '그래프', '온도', '열전달', '시간상수'],
  connections: oneWireConnections(['DS18B20']),
  sketch: e3Sketch,
  tunable: { anchor: 'ambientTemperatureC', name: '주변 온도 (°C)', hint: '실험 전후 주변 공기 온도의 평균을 입력하세요.' },
  overview: '따뜻한 물이 주변 온도에 가까워지는 과정을 기록해 온도 차의 지수 감소를 확인합니다.',
  procedure: '화상 위험이 없는 따뜻한 물을 사용하고 센서 깊이와 물의 양을 고정하세요. 주변 온도를 따로 재고 물을 젓는 조건을 일정하게 유지하며 충분히 긴 시간 기록하세요.',
  science: '열손실률이 물과 주변의 온도 차에 비례한다고 보면 T-Ta = (T0-Ta)e^(-kt)입니다. 증발, 자연대류, 용기 열용량과 실내 기류는 k를 바꿉니다.',
  applicationGuide: '용기 재질, 뚜껑 유무 또는 물의 양을 바꾸고 ln(T-Ta)-시간 그래프의 기울기로 냉각 상수를 비교하세요.',
  troubleshooting: [
    contactTroubleshooting,
    { symptom: '온도가 계단처럼 늦게 변하거나 갑자기 바뀜', cause: '센서가 용기 벽에 닿거나 물이 충분히 섞이지 않아 국소 온도를 읽고 있습니다.', fix: '센서를 물 중앙에 고정하고 일정한 방법으로 천천히 저으세요.' },
  ],
})
