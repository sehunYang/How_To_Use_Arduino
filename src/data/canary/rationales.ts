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
    whyText: '조도를 정밀하게 측정할 수 있지만 I2C 주소가 고정되어 있어, 여러 개를 쓰려면 멀티플렉서와 함께 배워야 합니다.',
  },
  {
    sensorId: 'tca9548a',
    subject: null,
    whyText: '주소가 고정된 센서를 여러 개 동시에 연결하려면 이 멀티플렉서가 반드시 필요합니다.',
  },
  {
    sensorId: 'ina219',
    subject: null,
    whyText: '전압 강하를 이용해 회로의 전류와 전력을 디지털 값으로 측정할 수 있습니다.',
  },
]
