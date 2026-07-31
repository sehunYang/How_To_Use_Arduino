import type { SensorRationale } from '@/schema'

export const canaryRationales: SensorRationale[] = [
  {
    sensorId: 'mpu6050',
    subject: '물리',
    whyText: '가속도와 각속도를 동시에 측정할 수 있어서 진자의 기울기와 속도를 직접 잴 수 있기 때문입니다.',
  },
  {
    sensorId: 'tsl2591',
    subject: null,
    whyText: '조도를 정밀하게 측정할 수 있지만 I2C 주소가 고정되어 있어, 여러 개를 쓰려면 연결할 센서를 번갈아 골라 주는 장치(멀티플렉서)와 함께 배워야 합니다.',
  },
  {
    sensorId: 'tca9548a',
    subject: null,
    whyText: '주소가 고정된 센서를 여러 개 동시에 연결하려면 이 채널 선택 장치가 반드시 필요합니다.',
  },
  {
    sensorId: 'ina219',
    subject: null,
    whyText: '부품을 지날 때 생기는 전압 차이를 이용해 회로의 전류와 전력을 디지털 값으로 측정할 수 있습니다.',
  },
  {
    sensorId: 'bme280',
    subject: null,
    whyText: '온도·습도·기압을 한 모듈에서 함께 측정해 세 환경값의 관계를 탐구할 수 있습니다.',
  },
  {
    sensorId: 'ds18b20',
    subject: null,
    whyText: '접촉한 물체나 액체의 온도를 디지털 값으로 안정적으로 측정할 수 있습니다.',
  },
  {
    sensorId: 'cds',
    subject: null,
    whyText: '빛의 세기에 따라 저항이 달라지므로 간단한 분압 회로로 상대적인 밝기를 측정할 수 있습니다.',
  },
  {
    sensorId: 'hc-sr501',
    subject: null,
    whyText: '사람이나 동물의 움직임에서 발생하는 적외선 변화를 감지해 활동 여부를 기록할 수 있습니다.',
  },
  {
    sensorId: 'hc-sr04',
    subject: null,
    whyText: '초음파의 왕복 시간을 이용해 물체까지의 거리와 위치 변화를 측정할 수 있습니다.',
  },
  {
    sensorId: 'hbe0704',
    subject: null,
    whyText: '자석의 접근과 회전에 따른 자기장 변화를 전기 신호로 감지할 수 있습니다.',
  },
]
