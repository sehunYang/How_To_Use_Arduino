import { contactTroubleshooting, createProjectRecipe, i2cTroubleshooting, type Connection } from './shared'
import { e1Sketch } from './sketches'

const connections: Connection[] = [
  { from: 'BME280.VCC', to: 'UNO.5V', color: 'red', text: '5V 입력을 지원하는 BME280 모듈의 VCC를 아두이노 5V에 연결하세요. 센서 단품은 3.3V 전용이므로 모듈 표기를 확인하세요.' },
  { from: 'BME280.GND', to: 'UNO.GND', color: 'black', text: 'BME280 GND를 아두이노 GND에 연결하세요.' },
  { from: 'BME280.SDA', to: 'UNO.A4', color: 'green', text: 'BME280 SDA를 아두이노 A4에 연결하세요.' },
  { from: 'BME280.SCL', to: 'UNO.A5', color: 'yellow', text: 'BME280 SCL을 아두이노 A5에 연결하세요.' },
  { from: 'RELAY.IN', to: 'UNO.D7', color: 'orange', text: '릴레이 모듈 IN을 아두이노 D7에 연결하세요.' },
  { from: 'RELAY.VCC', to: 'UNO.5V', color: 'red', text: '릴레이 모듈 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'RELAY.GND', to: 'UNO.GND', color: 'black', text: '릴레이 모듈 GND를 아두이노 GND에 연결하세요.' },
  { from: 'FAN_SUPPLY.+', to: 'RELAY.COM', color: 'red', text: '팬 정격에 맞는 별도 5V 전원의 양극을 릴레이 COM 단자에 연결하세요. 아두이노 5V 핀으로 팬을 구동하지 마세요.' },
  { from: 'RELAY.NO', to: 'FAN.POSITIVE', color: 'purple', text: '릴레이 NO 단자를 팬의 양극에 연결하세요. 릴레이가 켜지면 COM과 NO가 붙어 팬에 전원이 들어갑니다.' },
  { from: 'FAN.NEGATIVE', to: 'FAN_SUPPLY.-', color: 'black', text: '팬의 음극을 별도 전원의 음극에 연결해 접점 회로를 닫으세요.' },
]

export const e1Recipe = createProjectRecipe({
  id: 'fan-control',
  title: '온습도에 따른 자동 환풍기 제어',
  subject: '화학·환경',
  difficulty: '중급',
  minutes: 65,
  sensors: ['bme280'],
  actuators: ['relay-module', 'dc-fan-5v'],
  coreKeywords: ['환풍기', '팬', '더우면', '온도', '습도', 'BME280', '릴레이', '자동제어'],
  connections,
  sketch: e1Sketch,
  tunable: { anchor: 'humidityOnPercent', name: '팬 작동 습도 (%)', hint: '센서 오차와 잦은 스위칭을 고려해 실제 환경에서 충분한 여유를 두세요.' },
  overview: 'BME280으로 온도와 상대습도를 읽고 기준을 넘으면 릴레이로 저전압 팬을 작동시킵니다.',
  procedure: '센서를 팬 바람과 물방울이 직접 닿지 않는 곳에 놓고 팬을 끈 상태의 기준값을 기록하세요. 습도를 천천히 변화시키며 작동 시점과 환기 후 회복 시간을 관찰하세요.',
  science: '상대습도는 같은 수증기량에서도 온도에 따라 달라집니다. 기준값이 하나뿐이면 경계에서 릴레이가 반복 동작할 수 있으므로 실제 제어에서는 켜는 기준과 끄는 기준을 서로 다르게 두는 것이 좋습니다.',
  applicationGuide: '켜짐과 꺼짐 임계값을 5%p 정도 다르게 만들고, 팬 작동 전후의 온습도 변화율을 비교하세요.',
  troubleshooting: [
    i2cTroubleshooting,
    contactTroubleshooting,
    { symptom: '릴레이는 딸깍거리지만 팬이 돌지 않음', cause: '팬 전원이 접점 회로에 없거나 COM/NO 배선이 잘못되었습니다.', fix: '별도 5V 전원 + → COM, NO → 팬 +, 팬 − → 전원 − 경로가 모두 이어졌는지 확인하고 아두이노로 팬을 직접 구동하지 마세요.' },
    { symptom: '조건이 아닐 때 팬이 돌고 조건일 때 멈춤', cause: '많은 저가 릴레이 모듈은 IN이 LOW일 때 접점이 붙는 방식(액티브 로우)입니다. 이 스케치는 HIGH일 때 켜지는 모듈을 가정합니다.', fix: '모듈 표기를 확인하고 액티브 로우라면 digitalWrite(RELAY, on)을 digitalWrite(RELAY, !on)으로 바꾸세요.' },
  ],
})
