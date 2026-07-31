export interface SensorSpec {
  label: string
  value: string
}

export interface SensorProfile {
  id: string
  quantities: string[]
  summary: string
  output: string
  specs: SensorSpec[]
  experiments: string[]
  cautions: string[]
}

export function profileForSensor(sensor: Sensor): SensorProfile {
  return sensorProfileById.get(sensor.id) ?? {
    id: sensor.id,
    quantities: ['측정값'],
    summary: `${sensor.name}에서 측정값을 읽어 탐구 활동에 활용하는 센서입니다.`,
    output: `${sensor.interface.toUpperCase()} 방식의 측정값`,
    specs: [
      { label: '통신 방식', value: sensor.interface.toUpperCase() },
      { label: '소비 전류', value: `${sensor.currentDrawMa}mA` },
    ],
    experiments: [`${sensor.name}의 측정값이 환경에 따라 어떻게 달라지는지 비교하기`],
    cautions: ['전원 전압과 핀 배열을 확인한 뒤 연결하세요.'],
  }
}

export const sensorProfiles: SensorProfile[] = [
  {
    id: 'ina219',
    quantities: ['전류', '전압', '전력'],
    summary: '회로에 흐르는 전류와 부하의 전압을 I2C로 읽어 소비 전력을 계산하는 전류 센서입니다.',
    output: 'I2C 디지털 값 · 전류(mA), 회로 쪽 전압(V), 전력(mW)',
    specs: [
      { label: '대표 측정 범위', value: '회로 쪽 전압 0~26V, 전류 범위는 전류 측정용 작은 저항과 보정값에 따라 결정' },
      { label: '아날로그-디지털 변환', value: '전류와 전압을 12비트 숫자로 변환' },
      { label: 'I2C 주소', value: '0x40, 0x41, 0x44, 0x45' },
      { label: '핀 구성', value: 'VCC, GND, SCL, SDA, VIN+, VIN−' },
      { label: 'VIN+/VIN− 역할', value: '측정할 전류가 흐르는 직렬 측정 경로' },
    ],
    experiments: ['태양전지 각도에 따른 출력 전력', '모터 부하에 따른 소비 전류', 'LED 밝기와 소비 전력 비교'],
    cautions: ['전류가 센서의 VIN+와 VIN- 경로를 지나도록 직렬로 연결합니다.', '측정 범위는 사용하는 모듈의 션트 저항 정격을 확인합니다.'],
  },
  {
    id: 'tsl2591',
    quantities: ['조도', '적외선·가시광 세기'],
    summary: '매우 어두운 곳부터 밝은 환경까지 넓은 범위의 빛을 두 채널로 측정하는 디지털 조도 센서입니다.',
    output: 'I2C 16비트 채널 값 · 가시광/적외선 센서가 읽은 가공 전 값과 계산 조도(lux)',
    specs: [
      { label: '대표 조도 범위', value: '약 188µlux~88,000lux' },
      { label: '빛을 모아 측정하는 시간', value: '100~600ms 선택' },
      { label: 'I2C 주소', value: '0x29 고정' },
      { label: '핀 구성', value: 'VIN, GND, 3Vo, INT, SDA, SCL' },
      { label: '보조 핀', value: '3Vo는 전압 조절 회로 출력, INT는 설정한 기준을 넘으면 알림 신호를 내는 출력' },
    ],
    experiments: ['빛의 거리와 조도 관계', '필터 재질별 빛 투과율', '식물 생장 위치의 일일 광량 기록'],
    cautions: ['주소가 고정되어 두 개 이상 사용할 때는 TCA9548A처럼 여러 센서 연결 중 하나를 골라 주는 장치가 필요합니다.', '강한 빛에서는 신호 증폭 정도나 빛을 모아 측정하는 시간을 낮춰 측정 범위를 넘어 값이 최댓값에 머무는 현상을 피합니다.'],
  },
  {
    id: 'mpu6050',
    quantities: ['가속도', '각속도', '기울기'],
    summary: '3축 가속도계와 3축 자이로스코프를 한 칩에 담아 물체의 움직임과 회전을 측정합니다.',
    output: 'I2C 16비트 축별 값 · ax/ay/az와 gx/gy/gz',
    specs: [
      { label: '가속도 범위', value: '±2g, ±4g, ±8g, ±16g' },
      { label: '자이로 범위', value: '±250, ±500, ±1000, ±2000°/s' },
      { label: 'I2C 주소', value: '0x68 또는 0x69' },
      { label: '핀 구성', value: 'VCC, GND, SCL, SDA, XDA, XCL, AD0, INT' },
      { label: '보조 핀 역할', value: 'XDA/XCL은 보조 I2C, AD0는 주소 선택, INT는 조건이 맞으면 즉시 알림 신호를 내는 출력' },
    ],
    experiments: ['단진자의 주기 측정', '충돌 순간의 최대 가속도', '회전판의 각속도 비교'],
    cautions: ['정지 상태의 영점 오차를 먼저 측정해 보정합니다.', '진동이 크면 여러 값을 평균하거나 저역통과 필터를 사용합니다.'],
  },
  {
    id: 'bme280',
    quantities: ['온도', '습도', '기압'],
    summary: '온도·상대습도·대기압을 동시에 읽어 환경 변화를 기록할 수 있는 복합 센서입니다.',
    output: 'I2C 디지털 값 · °C, %RH, hPa',
    specs: [
      { label: '온도 범위', value: '-40~85°C' },
      { label: '습도 범위', value: '0~100%RH' },
      { label: '기압 범위', value: '300~1100hPa' },
      { label: 'I2C 주소', value: '0x76 또는 0x77' },
    ],
    experiments: ['교실 환기 전후 환경 변화', '고도에 따른 기압 비교', '물의 증발과 주변 습도'],
    cautions: ['사람의 손이나 발열 부품 가까이에서는 온도값이 높게 측정될 수 있습니다.', '급격한 습도 변화 뒤에는 안정화 시간을 둡니다.'],
  },
  {
    id: 'ds18b20',
    quantities: ['온도'],
    summary: '각 센서가 고유 주소를 가져 한 가닥 데이터선에 여러 개를 연결할 수 있는 디지털 온도 센서입니다.',
    output: '1-Wire 디지털 온도값 · °C',
    specs: [
      { label: '측정 범위', value: '-55~125°C' },
      { label: '대표 정확도', value: '-10~85°C 구간에서 ±0.5°C' },
      { label: '해상도', value: '9~12비트 선택' },
    ],
    experiments: ['물의 냉각 곡선', '단열재별 온도 유지 성능', '토양 깊이에 따른 온도'],
    cautions: ['DATA와 VCC 사이에 신호선을 기본 HIGH 상태로 유지하는 4.7kΩ 저항이 필요합니다.', '방수형 프로브도 접합부의 방수 상태를 확인합니다.'],
  },
  {
    id: 'tca9548a',
    quantities: ['I2C 채널 선택'],
    summary: '주소가 같은 I2C 센서를 최대 8개 연결로 나누어 번갈아 사용할 수 있게 하는 채널 선택 장치입니다.',
    output: 'I2C에서 사용할 채널을 고르는 8비트 제어값',
    specs: [
      { label: '채널 수', value: '8개 독립 I2C 채널' },
      { label: '자체 I2C 주소', value: '0x70~0x77' },
      { label: '용도', value: '동일 주소 센서 분리 또는 긴 I2C 배선 구간 나누기' },
      { label: '핀 구성', value: 'VIN, GND, SDA, SCL, RST, A0~A2, SD0/SC0~SD7/SC7 (총 24핀)' },
    ],
    experiments: ['동일한 조도센서 두 지점 비교', '여러 화분의 환경 센서 순차 측정', '채널 전환 지연에 따른 안정성'],
    cautions: ['센서가 아니라 I2C 연결 확장 부품이므로 측정값을 직접 만들지는 않습니다.', '읽기 전에 사용할 채널을 선택해야 합니다.'],
  },
  {
    id: 'cds',
    quantities: ['상대적인 밝기'],
    summary: '빛이 밝아질수록 저항이 변하는 광저항을 사용해 주변 밝기를 간단히 비교합니다.',
    output: '아날로그 전압 · 아날로그 전압을 숫자로 바꾼 값(보통 0~1023)',
    specs: [
      { label: '핀 구성', value: 'L1, L2 두 다리(극성 없음)' },
      { label: '출력 방식', value: '외부 10 kΩ 저항과 CDS 사이 전압 측정 지점의 아날로그 전압' },
      { label: '반응 특성', value: '밝기와 일정한 비율로 변하지 않음' },
      { label: '적합한 측정', value: '절대 lux보다 밝고 어두움의 상대 비교' },
    ],
    experiments: ['그림자 경계 측정', '재료별 빛 차단 정도', '자동 야간등 기준값 찾기'],
    cautions: ['개체별 편차가 커서 실험 시작 전에 밝고 어두운 기준값을 측정합니다.', '정밀한 lux 측정에는 디지털 조도 센서를 사용합니다.'],
  },
  {
    id: 'hc-sr501',
    quantities: ['사람·동물의 움직임'],
    summary: '따뜻한 사람이나 동물이 움직일 때 생기는 적외선 변화를 감지하는 인체 움직임 감지용 적외선(PIR) 센서입니다.',
    output: '디지털 HIGH/LOW · 움직임 감지 여부',
    specs: [
      { label: '대표 감지 거리', value: '약 3~7m, 모듈 가변저항으로 조절' },
      { label: '감지 각도', value: '센서 앞쪽으로 약 110° 퍼지는 범위' },
      { label: '출력', value: '감지 시 HIGH, 유지 시간 조절 가능' },
    ],
    experiments: ['시간대별 활동 빈도', '감지 거리와 방향 비교', '복도 자동 조명'],
    cautions: ['전원을 켠 직후 안정화 시간이 필요합니다.', '유리 너머나 정지한 사람은 잘 감지하지 못합니다.'],
  },
  {
    id: 'hc-sr04',
    quantities: ['거리'],
    summary: '초음파를 보낸 뒤 되돌아오는 시간을 측정해 물체까지의 거리를 계산합니다.',
    output: 'ECHO 핀이 HIGH로 유지되는 시간(µs) · 음속으로 환산한 거리(cm)',
    specs: [
      { label: '대표 측정 범위', value: '약 2~400cm' },
      { label: '대표 분해능', value: '약 3mm' },
      { label: '초음파 주파수', value: '40kHz' },
    ],
    experiments: ['낙하 물체의 위치-시간 그래프', '주차 거리 경보기', '수면 높이 변화'],
    cautions: ['부드럽거나 기울어진 표면은 초음파를 다른 방향으로 반사할 수 있습니다.', '연속 측정 사이에 충분한 간격을 둡니다.'],
  },
  {
    id: 'hbe0704',
    quantities: ['자기장 변화', '자석 통과 횟수'],
    summary: '자석이 가까워질 때 출력이 변하는 홀 효과를 이용해 회전과 위치를 감지합니다.',
    output: '아날로그 전압 · 자기장에 따라 아날로그 전압을 숫자로 바꾼 값',
    specs: [
      { label: '출력 방식', value: '자기장 세기와 방향에 따른 아날로그 출력' },
      { label: '주요 용도', value: '회전수, 자석 통과, 근접 위치 측정' },
      { label: '보정', value: '자석이 없을 때의 기준 전압을 먼저 측정' },
    ],
    experiments: ['바퀴 회전수(RPM) 측정', '자석 거리와 출력 변화', '진자의 통과 횟수 세기'],
    cautions: ['자석의 극 방향에 따라 출력 변화 방향이 달라질 수 있습니다.', '모듈 버전에 따라 출력 범위가 다르므로 기준값을 직접 측정합니다.'],
  },
]

export const sensorProfileById = new Map(sensorProfiles.map((profile) => [profile.id, profile]))
import type { Sensor } from '@/schema'
