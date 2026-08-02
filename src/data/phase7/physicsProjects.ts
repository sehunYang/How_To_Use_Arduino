import type { Recipe } from '@/schema'
import { mpu6050, ultrasonic } from './connections'
import { contactTroubleshooting, createPhase7Recipe, i2cTroubleshooting } from './shared'

/**
 * E 묶음 — 물리 3건.
 *
 * 물리는 이미 49건으로 포화 상태였습니다. 그래서 여기서는 수를 늘리지 않고,
 * 기존 49건이 다루지 않은 세 가지만 넣습니다. **공기 저항이 지배하는 운동**,
 * **진폭이 줄어드는 과정**, 그리고 **질량이 아니라 질량의 배치가 정하는
 * 회전의 어려움**입니다. 셋 모두 "마찰이 없다고 치면"이라는 교과서의 가정을
 * 걷어 내는 자리입니다.
 */

const terminalVelocitySketch = `// @pin TRIG=D7
// @pin ECHO=D6
// @baud 115200

const byte TRIG_PIN = 7, ECHO_PIN = 6;
// 표본 간격입니다. 낙하 전체가 1초 남짓이므로 촘촘해야 모양이 보입니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 50;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  Serial.println("time_ms,distance_cm");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);

  // 속도는 여기서 계산하지 않습니다. 거리의 차이를 시간의 차이로 나누는
  // 계산은 저장한 CSV에서 하면 되고, 그래야 잡음을 다듬는 방법을 나중에
  // 바꿔 볼 수 있습니다.
  Serial.print(last); Serial.print(',');
  Serial.println(us == 0 ? -1 : (long)(us / 58));
}
`

const dampingSketch = `#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

MPU6050 imu;
// 표본 간격입니다. 한 주기에 표본이 50개는 들어가야 봉우리가 뚜렷합니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 20;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,g_norm");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 최하점을 지날 때마다 가속도 크기에 봉우리가 하나씩 생깁니다. 봉우리의
  // 높이가 줄어드는 모양이 이 탐구가 보려는 것입니다.
  Serial.print(last); Serial.print(',');
  Serial.println(sqrt(gx * gx + gy * gy + gz * gz), 4);
}
`

const inertiaSketch = `#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

MPU6050 imu;
// 표본 간격입니다. 감속 곡선의 기울기를 재려면 촘촘할수록 좋습니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 20;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,gyro_z_dps");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  int16_t gx, gy, gz;
  imu.getRotation(&gx, &gy, &gz);
  // 기본 설정에서 자이로는 ±250 °/s 범위이고 눈금 하나가 131분의 1도입니다.
  // 이 범위를 넘기면 값이 평평하게 잘리므로 너무 세게 돌리지 마세요.
  Serial.print(last); Serial.print(',');
  Serial.println(gz / 131.0, 3);
}
`

export const phase7PhysicsProjects: Recipe[] = [
  createPhase7Recipe({
    id: 'e1-terminal-velocity',
    title: '공기 저항과 종단 속도 (커피 필터 낙하)',
    subject: '물리',
    type: 'project',
    difficulty: '중급',
    minutes: 50,
    sensors: ['hc-sr04'],
    coreKeywords: ['공기 저항', '종단 속도', '낙하', '질량', '등속'],
    connections: ultrasonic('D7', 'D6'),
    sketch: terminalVelocitySketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '낙하 전체가 1초 남짓입니다. 50 ms보다 크면 모양을 놓칩니다.' },
    overview: '커피 필터를 초음파 센서 위에서 떨어뜨려 거리를 촘촘히 기록하고, 낙하 후반에 속도가 더 이상 커지지 않는 구간이 나타나는지 확인합니다.',
    procedure: '센서를 바닥에 위를 보게 놓고 필터를 그 정중앙 1.5 m 위에서 손을 펴 떨어뜨리세요. 필터를 겹치는 장수를 1장부터 5장까지 바꿔 가며 각 조건을 8회씩 반복하세요.',
    science: '떨어지는 물체에는 중력과 공기 저항이 함께 걸립니다. 공기 저항은 빠를수록 커지므로 어느 속도에 이르면 두 힘이 같아져 더 이상 빨라지지 않습니다. 이 속도를 종단 속도라 합니다. 커피 필터는 가볍고 넓어 종단 속도가 낮아 1.5 m 안에서도 등속 구간이 나타납니다. 필터를 겹치면 넓이는 그대로인데 무게만 늘어, 무게와 종단 속도의 관계를 넓이를 바꾸지 않고 볼 수 있습니다.',
    safety: '의자를 밟고 올라서지 말고 자를 이용해 높이를 맞추세요. 센서 위로 무거운 물건을 떨어뜨리지 마세요.',
    applicationGuide: '거리-시간 그래프의 기울기가 일정해지는 구간을 종단 속도로 읽고, 겹친 장수를 가로축으로 종단 속도의 제곱을 세로축에 그려 직선이 되는지 확인하세요.',
    troubleshooting: [
      { symptom: '거리가 -1로 자주 기록됨', cause: '필터가 소리를 잘 되돌리지 않거나 센서 정중앙을 벗어났습니다.', fix: '필터 아래에 지름 10 cm의 얇은 판지를 붙이고 낙하 자리를 정중앙에 맞추세요.' },
      { symptom: '속도가 끝까지 계속 커짐', cause: '낙하 거리가 짧아 종단 속도에 이르기 전에 바닥에 닿았습니다.', fix: '높이를 2 m 이상으로 올리거나 더 가벼운 필터를 쓰세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'e2-pendulum-damping',
    title: '진자의 감쇠와 에너지 손실률',
    subject: '물리',
    type: 'project',
    difficulty: '중급',
    minutes: 55,
    sensors: ['mpu6050'],
    coreKeywords: ['단진자', '감쇠', '진폭', '에너지 손실', '지수 감소'],
    connections: mpu6050(),
    sketch: dampingSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '한 주기에 표본이 50개는 들어가야 합니다. 20 ms에서 시작하세요.' },
    overview: '가속도 센서를 매단 진자를 한 번 밀고 멈출 때까지 그대로 기록해, 흔들리는 폭이 줄어드는 모양과 그 속도를 구합니다.',
    procedure: '추를 같은 각도에서 놓아 흔들고 진폭이 처음의 4분의 1이 될 때까지 기록을 멈추지 마세요. 추에 종이 날개를 붙인 조건과 붙이지 않은 조건에서 각각 5회씩 하세요.',
    science: '실제 진자는 공기 저항과 매단 곳의 마찰로 에너지를 잃어 진폭이 줄어듭니다. 잃는 에너지가 남아 있는 에너지에 비례하면 진폭은 시간에 대해 지수 모양으로 줄고, 로그를 취하면 직선이 됩니다. 진폭이 줄어도 주기는 거의 그대로인 것이 단진자의 특징이며, 이 탐구는 그 두 가지를 한 기록에서 함께 확인합니다.',
    safety: '흔들리는 추가 사람이나 물건에 닿지 않도록 둘레를 비우고, 센서 선이 추의 움직임에 끌려가지 않게 여유를 두세요.',
    applicationGuide: '봉우리의 높이를 차례로 읽어 로그를 취하고 시간에 대해 그려 직선의 기울기를 구하세요. 그 기울기가 감쇠 상수이며, 종이 날개를 붙였을 때 얼마나 커지는지 비교하세요.',
    troubleshooting: [
      { symptom: '봉우리가 고르지 않고 들쭉날쭉함', cause: '추가 앞뒤가 아니라 옆으로도 흔들리고 있습니다.', fix: '실 두 가닥을 V자로 매달아 한 평면에서만 흔들리게 하세요.' },
      { symptom: '로그 그래프가 직선이 아닙니다', cause: '큰 진폭에서는 공기 저항이 속도의 제곱에 가깝게 걸려 비례 관계가 깨집니다.', fix: '진폭이 작아진 뒤쪽 구간만으로 기울기를 구해 보세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'e3-moment-of-inertia',
    title: '회전 관성(관성 모멘트) 비교',
    subject: '물리',
    type: 'project',
    difficulty: '고급',
    minutes: 60,
    sensors: ['mpu6050'],
    coreKeywords: ['관성 모멘트', '회전 감쇠', '각속도', '질량 분포', '회전축'],
    connections: mpu6050(),
    sketch: inertiaSketch,
    tunable: { anchor: 'samplingIntervalMs', name: '표본 간격 (ms)', hint: '감속 곡선의 기울기를 재려면 촘촘할수록 좋습니다. 20 ms에서 시작하세요.' },
    overview: '같은 질량을 회전축 가까이 모았을 때와 바깥으로 옮겼을 때, 같은 세기로 돌린 회전판이 멈추기까지 각속도가 줄어드는 모양을 비교합니다.',
    procedure: '추 네 개를 회전판의 안쪽 구멍과 바깥쪽 구멍에 각각 꽂아 두 조건을 만드세요. 매번 같은 방법으로 돌리고 손을 뗀 뒤부터 완전히 멈출 때까지 기록하세요.',
    science: '회전을 시작하거나 멈추기 어려운 정도를 관성 모멘트라 하며, 질량뿐 아니라 그 질량이 회전축에서 얼마나 떨어져 있는지가 함께 정합니다. 같은 질량이라도 바깥으로 옮기면 관성 모멘트가 거리의 제곱에 비례해 커집니다. 축의 마찰 토크가 두 조건에서 같다면, 관성 모멘트가 큰 쪽이 더 천천히 감속하므로 멈추기까지 더 오래 걸립니다.',
    safety: '회전판을 세게 돌리면 추가 튕겨 나갈 수 있습니다. 추를 나사로 단단히 고정하고 자이로의 측정 한계인 250 °/s를 넘지 않는 세기로 돌리세요.',
    applicationGuide: '각속도를 시간에 대해 그려 감속 구간의 기울기를 구하고, 두 조건의 기울기 비를 추의 거리의 제곱 비와 견주세요. 두 값이 비슷하면 마찰 토크가 같다는 가정이 성립한 것입니다.',
    troubleshooting: [
      { symptom: '그래프 시작 부분이 평평하게 잘림', cause: '자이로의 측정 한계 ±250 °/s를 넘었습니다.', fix: '더 약하게 돌리고, 잘린 구간은 기울기 계산에서 빼세요.' },
      { symptom: '두 조건의 감속 기울기가 거의 같음', cause: '추의 안쪽 자리와 바깥쪽 자리의 거리 차이가 작습니다.', fix: '두 자리의 반지름 차이가 두 배 이상 되도록 구멍을 다시 고르세요.' },
      i2cTroubleshooting,
    ],
  }),
]
