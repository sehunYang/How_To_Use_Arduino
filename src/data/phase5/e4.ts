import { contactTroubleshooting, createProjectRecipe, i2cConnections, i2cTroubleshooting } from './shared'
import { e4Sketch } from './sketches'

export const e4Recipe = createProjectRecipe({
  id: 'e4-weather-pressure',
  title: '기압 변화로 날씨 관측',
  subject: '화학·환경',
  difficulty: '초급',
  minutes: 45,
  sensors: ['bme280'],
  coreKeywords: ['기압', '날씨', 'BME280', '고기압', '저기압', '관측'],
  connections: i2cConnections('BME280'),
  sketch: e4Sketch,
  tunable: { anchor: 'seaLevelPressureHpa', name: '기준 해면기압 (hPa)', hint: '가까운 공식 관측소의 같은 시각 해면기압을 사용하세요.' },
  overview: '같은 장소의 기압을 장기간 기록하고 공식 날씨 기록과 함께 변화 경향을 관찰합니다.',
  procedure: '센서를 직사광선, 빗물, 선풍기 바람과 문 여닫기의 급격한 압력 변화에서 피하세요. 설치 높이를 바꾸지 않고 일정 간격으로 기록하며 가까운 공식 관측소 자료도 남기세요.',
  science: '기압은 고도뿐 아니라 이동하는 기단과 날씨계의 영향을 받습니다. 짧은 시간의 압력 하강은 저기압 접근과 함께 나타날 수 있지만 기압 하나만으로 특정 날씨를 단정할 수 없습니다.',
  applicationGuide: '24시간 이동평균과 3시간 변화량을 계산하고 강수·풍향 등 공식 관측값과 함께 해석하세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: '기압은 정상인데 계산 고도가 계속 달라짐', cause: '날씨에 따라 실제 해면기압이 변하지만 기준값을 고정했기 때문입니다.', fix: '고도 비교에는 같은 시각의 지역 해면기압을 쓰고 날씨 관측에는 원래 기압값을 사용하세요.' },
  ],
})
