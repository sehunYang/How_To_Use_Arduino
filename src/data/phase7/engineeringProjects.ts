import type { Recipe } from '@/schema'
import {
  buzzer,
  cdsDivider,
  ds18b20Bus,
  hallSensor,
  lcd1602,
  led,
  motorChannel,
  motorSupply,
  mpu6050,
  servo,
  tsl2591,
  ultrasonic,
} from './connections'
import {
  contactTroubleshooting,
  createPhase7Recipe,
  externalSupplyTroubleshooting,
  i2cTroubleshooting,
  type Connection,
} from './shared'

/**
 * D 묶음 — 공학·로봇 8건.
 *
 * A 묶음이 장치를 하나씩 "움직여 보는" 것이었다면, 여기서는 **센서가 읽은
 * 값이 장치를 움직이게** 합니다. 그래서 이 묶음의 탐구 질문은 모두 같은
 * 모양입니다. 무엇을 기준으로 켜고 끌 것인가, 그 기준 하나로 충분한가.
 *
 * 여덟 건 가운데 다섯 건이 문턱값을 씁니다. 문턱값 하나만 두면 값이 그
 * 언저리에서 흔들릴 때 장치가 떨리므로, 켜는 기준과 끄는 기준을 벌려 두는
 * 방법(이력)을 어느 레시피에서든 직접 재어 보게 했습니다.
 */

const speedControlSketch = `// @pin HALL=A0
// @pin IN1=D2
// @pin IN2=D4
// @pin ENA=D5
// @baud 9600

const byte HALL_PIN = A0, IN1 = 2, IN2 = 4, ENA = 5;
// 유지하려는 목표 회전수입니다. 모터가 낼 수 있는 범위 안에서 정하세요.
// @tunable targetRpm
int targetRpm = 120;

int speedValue = 150;
unsigned long windowStart = 0;
int pulses = 0;
bool wasNear = false;

void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(ENA, OUTPUT);
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  analogWrite(ENA, speedValue);
  windowStart = millis();
  Serial.println("time_ms,rpm,speed_value,rpm_error");
}

void loop() {
  // 자석이 지나가면 홀 센서 값이 영점에서 크게 벗어납니다. 한 번 지나갈 때
  // 여러 번 세지 않도록, 벗어난 상태에서 돌아온 순간에만 하나로 셉니다.
  bool near = abs(analogRead(HALL_PIN) - 512) > 80;
  if (near && !wasNear) pulses++;
  wasNear = near;

  if (millis() - windowStart >= 1000) {
    int rpm = pulses * 60;
    int rpmError = targetRpm - rpm;
    // 모자라면 조금 올리고 넘치면 조금 내립니다. 한 번에 크게 고치면
    // 목표를 지나쳐 위아래로 출렁입니다.
    speedValue += rpmError > 0 ? 5 : -5;
    speedValue = constrain(speedValue, 0, 255);
    analogWrite(ENA, speedValue);

    Serial.print(millis()); Serial.print(',');
    Serial.print(rpm); Serial.print(',');
    Serial.print(speedValue); Serial.print(',');
    Serial.println(rpmError);

    pulses = 0;
    windowStart = millis();
  }
}
`

const levelSketch = `#include <Wire.h>
#include <MPU6050.h>
#include <LiquidCrystal_I2C.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

MPU6050 imu;
LiquidCrystal_I2C lcd(0x27, 16, 2);
// 화면에 띄우기 전 평균 낼 표본 수입니다. 늘리면 값이 안정되지만 느려집니다.
// @tunable averageCount
int averageCount = 20;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  lcd.init();
  lcd.backlight();
  Serial.println("time_ms,roll_deg,pitch_deg");
}

void loop() {
  long sx = 0, sy = 0, sz = 0;
  for (int i = 0; i < averageCount; i++) {
    int16_t ax, ay, az;
    imu.getAcceleration(&ax, &ay, &az);
    sx += ax; sy += ay; sz += az;
    delay(5);
  }
  float x = (float)sx / averageCount, y = (float)sy / averageCount, z = (float)sz / averageCount;
  // 중력이 어느 쪽으로 기울었는지로 각도를 냅니다. 움직이는 동안에는
  // 가속도가 섞여 들어와 이 계산이 성립하지 않습니다.
  float roll = atan2(y, z) * 180.0 / PI;
  float pitch = atan2(-x, sqrt(y * y + z * z)) * 180.0 / PI;

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Roll  "); lcd.print(roll, 1);
  lcd.setCursor(0, 1); lcd.print("Pitch "); lcd.print(pitch, 1);

  Serial.print(millis()); Serial.print(',');
  Serial.print(roll, 2); Serial.print(',');
  Serial.println(pitch, 2);
}
`

const lineFollowerSketch = `// @pin LEFT_CDS=A0
// @pin RIGHT_CDS=A1
// @pin IN1=D2
// @pin IN2=D4
// @pin ENA=D5
// @pin IN3=D7
// @pin IN4=D8
// @pin ENB=D6
// @baud 9600

const byte IN1 = 2, IN2 = 4, ENA = 5, IN3 = 7, IN4 = 8, ENB = 6;
const int BASE_SPEED = 140;
// 좌우 밝기 차이를 속도 차이로 바꾸는 비율입니다. 크면 민감하게 꺾습니다.
// @tunable turnGain
float turnGain = 0.35;

void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(ENA, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT); pinMode(ENB, OUTPUT);
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH); digitalWrite(IN4, LOW);
  Serial.println("time_ms,left_adc,right_adc,left_speed,right_speed");
}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A1);
  // 검은 선 위에 있는 쪽은 빛을 덜 되돌려 보내 값이 다릅니다. 그 차이만큼
  // 한쪽 바퀴를 늦춰 차체를 선 쪽으로 되돌립니다.
  int correction = (int)((left - right) * turnGain);
  int leftSpeed = constrain(BASE_SPEED - correction, 0, 255);
  int rightSpeed = constrain(BASE_SPEED + correction, 0, 255);
  analogWrite(ENA, leftSpeed);
  analogWrite(ENB, rightSpeed);

  Serial.print(millis()); Serial.print(',');
  Serial.print(left); Serial.print(',');
  Serial.print(right); Serial.print(',');
  Serial.print(leftSpeed); Serial.print(',');
  Serial.println(rightSpeed);
  delay(50);
}
`

const barrierSketch = `#include <Servo.h>

// @pin TRIG=D7
// @pin ECHO=D6
// @pin SERVO=D9
// @pin BUZZER=D8
// @baud 9600

const byte TRIG_PIN = 7, ECHO_PIN = 6, BUZZER_PIN = 8;
Servo bar;
// 차단기를 여는 거리입니다. 닫는 거리는 이보다 5 cm 넉넉히 잡습니다.
// @tunable openCm
int openCm = 20;

bool isOpen = false;

long readCm() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  return us == 0 ? -1 : (long)(us / 58);
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  bar.attach(9);
  bar.write(0);
  Serial.println("time_ms,distance_cm,door_state,buzzer_on");
}

void loop() {
  long cm = readCm();
  // 여는 기준과 닫는 기준을 벌려 둡니다. 하나로 두면 차가 그 거리 언저리에
  // 서 있을 때 차단기가 계속 여닫히며 떨립니다.
  if (!isOpen && cm > 0 && cm < openCm) isOpen = true;
  if (isOpen && (cm < 0 || cm > openCm + 5)) isOpen = false;

  bar.write(isOpen ? 90 : 0);
  int buzzerOn = (cm > 0 && cm < openCm / 2) ? 1 : 0;
  if (buzzerOn) tone(BUZZER_PIN, 1200); else noTone(BUZZER_PIN);

  Serial.print(millis()); Serial.print(',');
  Serial.print(cm); Serial.print(',');
  Serial.print(isOpen ? 1 : 0); Serial.print(',');
  Serial.println(buzzerOn);
  delay(100);
}
`

const curtainSketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>
#include <Servo.h>

// @pin SERVO=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
Servo curtain;
// 이 밝기를 넘으면 커튼을 엽니다. 닫는 기준은 이 값의 절반으로 둡니다.
// @tunable openLux
float openLux = 300.0;

bool isOpen = false;

void setup() {
  Serial.begin(9600);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  curtain.attach(9);
  curtain.write(0);
  Serial.println("time_ms,lux,commanded_deg");
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  float lux = tsl.calculateLux(lum & 0xffff, lum >> 16);

  // 여는 밝기와 닫는 밝기를 두 배 차이로 벌려 둡니다. 구름이 지나갈 때마다
  // 커튼이 여닫히면 서보와 기구물이 먼저 상합니다.
  if (!isOpen && lux > openLux) isOpen = true;
  if (isOpen && lux < openLux / 2) isOpen = false;

  int angle = isOpen ? 120 : 0;
  curtain.write(angle);

  Serial.print(millis()); Serial.print(',');
  Serial.print(lux, 2); Serial.print(',');
  Serial.println(angle);
  delay(1000);
}
`

const alarmSketch = `#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @pin BUZZER=D8
// @pin LED=D9
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
const byte BUZZER_PIN = 8, LED_PIN = 9;
// 경보를 울릴 온도입니다. 경보를 푸는 온도는 이보다 1 °C 낮게 둡니다.
// @tunable alarmC
float alarmC = 30.0;

bool alarming = false;

void setup() {
  Serial.begin(9600);
  probe.begin();
  probe.setResolution(12);
  pinMode(BUZZER_PIN, OUTPUT); pinMode(LED_PIN, OUTPUT);
  Serial.println("time_ms,temperature_c,alarm_state");
}

void loop() {
  probe.requestTemperatures();
  float celsius = probe.getTempCByIndex(0);

  // 울리는 기준과 그치는 기준을 1 °C 벌려 둡니다. 같은 값으로 두면 온도가
  // 그 언저리에서 흔들릴 때 부저가 따다닥 끊어져 울립니다.
  if (!alarming && celsius > alarmC) alarming = true;
  if (alarming && celsius < alarmC - 1.0) alarming = false;

  digitalWrite(LED_PIN, alarming ? HIGH : LOW);
  if (alarming) tone(BUZZER_PIN, 880); else noTone(BUZZER_PIN);

  Serial.print(millis()); Serial.print(',');
  Serial.print(celsius, 2); Serial.print(',');
  Serial.println(alarming ? 1 : 0);
  delay(1000);
}
`

const vibrationSketch = `#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin BUZZER=D8
// @baud 9600

MPU6050 imu;
const byte BUZZER_PIN = 8;
// 이 크기를 넘는 흔들림을 침입으로 봅니다. 값이 작을수록 예민해집니다.
// @tunable triggerG
float triggerG = 0.08;

unsigned long alarmUntil = 0;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("time_ms,dynamic_g,alarm_state");
}

void loop() {
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 정지 상태에서도 중력 1 g가 잡힙니다. 그 몫을 뺀 나머지가 흔들림입니다.
  float dynamic = fabs(sqrt(gx * gx + gy * gy + gz * gz) - 1.0);

  // 한 번 울리면 3초는 유지합니다. 문이 흔들린 한순간만 울리고 그치면
  // 사람이 알아채기 전에 끝나 버립니다.
  if (dynamic > triggerG) alarmUntil = millis() + 3000;
  bool alarming = millis() < alarmUntil;
  if (alarming) tone(BUZZER_PIN, 1500); else noTone(BUZZER_PIN);

  Serial.print(millis()); Serial.print(',');
  Serial.print(dynamic, 4); Serial.print(',');
  Serial.println(alarming ? 1 : 0);
  delay(50);
}
`

const elevatorSketch = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Servo.h>

// @pin TRIG=D7
// @pin ECHO=D6
// @pin SERVO=D9
// @baud 9600

const byte TRIG_PIN = 7, ECHO_PIN = 6;
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo door;
// 한 층의 높이입니다. 모형의 실제 층 간격을 자로 재어 넣으세요.
// @tunable floorHeightCm
float floorHeightCm = 8.0;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT); pinMode(ECHO_PIN, INPUT);
  lcd.init();
  lcd.backlight();
  door.attach(9);
  door.write(0);
  Serial.println("time_ms,distance_cm,floor_index,commanded_deg");
}

long readCm() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  return us == 0 ? -1 : (long)(us / 58);
}

void loop() {
  long cm = readCm();
  // 거리를 층 높이로 나눠 반올림하면 층 번호가 됩니다. 층 간격보다 센서의
  // 흔들림이 크면 이 나눗셈이 층을 잘못 짚습니다.
  int floorIndex = cm > 0 ? (int)((cm + floorHeightCm / 2) / floorHeightCm) : -1;
  int angle = (cm > 0 && cm < floorHeightCm / 2) ? 90 : 0;
  door.write(angle);

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Floor "); lcd.print(floorIndex);
  lcd.setCursor(0, 1); lcd.print(cm); lcd.print(" cm");

  Serial.print(millis()); Serial.print(',');
  Serial.print(cm); Serial.print(',');
  Serial.print(floorIndex); Serial.print(',');
  Serial.println(angle);
  delay(300);
}
`

const speedControlConnections: Connection[] = [
  ...hallSensor('A0'),
  ...motorChannel('D2', 'D4', 'D5'),
  ...motorSupply(),
]
const lineFollowerConnections: Connection[] = [
  ...cdsDivider('CDS_1', 'CDS_RESISTOR_1', 'A0', '왼쪽'),
  ...cdsDivider('CDS_2', 'CDS_RESISTOR_2', 'A1', '오른쪽'),
  ...motorChannel('D2', 'D4', 'D5'),
  ...motorChannel('D7', 'D8', 'D6', 'B'),
  ...motorSupply(),
]
const barrierConnections: Connection[] = [...ultrasonic('D7', 'D6'), ...servo('D9'), ...buzzer('D8')]
const curtainConnections: Connection[] = [...tsl2591(), ...servo('D9')]
const alarmConnections: Connection[] = [...ds18b20Bus(['DS18B20'], 'D4'), ...buzzer('D8'), ...led('D9')]
const vibrationConnections: Connection[] = [...mpu6050(), ...buzzer('D8')]
const elevatorConnections: Connection[] = [...ultrasonic('D7', 'D6'), ...servo('D9'), ...lcd1602()]

export const phase7EngineeringProjects: Recipe[] = [
  createPhase7Recipe({
    id: 'd1-motor-speed-control',
    title: '목표 회전수를 유지하는 모터 속도 제어',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '고급',
    minutes: 60,
    sensors: ['hbe0704'],
    actuators: ['dc-motor-driver'],
    coreKeywords: ['되먹임', '회전수', '제어', '오차', '정정'],
    connections: speedControlConnections,
    sketch: speedControlSketch,
    tunable: { anchor: 'targetRpm', name: '목표 회전수 (rpm)', hint: '모터가 실제로 낼 수 있는 범위 안에서 정하세요. 120 rpm에서 시작합니다.' },
    overview: '바퀴에 붙인 자석을 홀 센서로 세어 실제 회전수를 구하고, 목표와의 차이만큼 모터에 보내는 값을 스스로 고쳐 회전수를 유지하게 합니다.',
    procedure: '차체를 컵 위에 올려 바퀴를 공중에 띄운 상태에서 먼저 시험하세요. 그다음 손가락으로 바퀴를 살짝 눌러 부하를 주고 회전수가 되돌아오는 과정을 기록하세요.',
    science: '보낸 값과 실제 회전수의 관계는 배터리 전압과 마찰에 따라 달라지므로, 값 하나를 정해 두는 방식으로는 회전수를 지킬 수 없습니다. 실제 값을 재어 목표와의 차이만큼 되돌리는 것을 되먹임 제어라 합니다. 한 번에 크게 고치면 목표를 지나쳐 위아래로 출렁이고, 너무 조금 고치면 늦게 도달합니다.',
    safety: '돌아가는 바퀴와 축에 손가락이나 머리카락이 닿지 않게 하세요. 부하를 줄 때는 바퀴 옆면이 아니라 위쪽을 가볍게 누르세요.',
    applicationGuide: '부하를 준 시각을 표시하고 회전수가 목표로 돌아오기까지 걸린 시간을 재세요. 한 번에 고치는 크기를 5에서 20으로 바꿔 되돌아오는 속도와 출렁임이 어떻게 달라지는지 비교하세요.',
    troubleshooting: [
      { symptom: '회전수가 0으로만 기록됨', cause: '자석이 홀 센서 앞을 지나지 않거나 감지 문턱이 높습니다.', fix: '자석과 센서 사이를 5 mm 안쪽으로 좁히고, 자석의 극을 뒤집어 값이 어느 쪽으로 벗어나는지 확인하세요.' },
      { symptom: '회전수가 목표 위아래로 계속 출렁임', cause: '한 번에 고치는 크기가 큽니다.', fix: '고치는 크기를 5에서 2로 줄이고 판정 창을 1초보다 길게 잡으세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'd2-digital-level',
    title: '디지털 수평계',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '초급',
    minutes: 45,
    sensors: ['mpu6050'],
    actuators: ['lcd1602-i2c'],
    coreKeywords: ['기울기', '중력', '영점 보정', '분해능', '표시'],
    connections: [...mpu6050(), ...lcd1602()],
    sketch: levelSketch,
    tunable: { anchor: 'averageCount', name: '평균 낼 표본 수 (개)', hint: '늘리면 값이 안정되지만 화면이 느리게 따라옵니다. 20에서 시작하세요.' },
    overview: '가속도 센서가 읽은 중력 방향으로 좌우와 앞뒤 기울기를 계산해 LCD에 실시간으로 띄우고, 각도기로 잰 실제 각도와 견줍니다.',
    procedure: '평평한 책상에서 값을 읽어 영점으로 적고, 책 한 권씩 괴어 가며 각도기로 잰 각도와 화면 값을 짝지어 적으세요. 값을 읽는 동안 판을 건드리지 마세요.',
    science: '가만히 있는 물체에는 중력만 걸리므로, 세 축이 나눠 받은 중력의 비율에서 기울어진 각도를 되돌려 구할 수 있습니다. 그러나 움직이는 동안에는 운동에 의한 가속도가 함께 섞여 이 계산이 성립하지 않습니다. 그래서 이 수평계는 멈춰 있을 때만 믿을 수 있습니다.',
    applicationGuide: '각도기로 잰 각도를 가로축, 화면 값을 세로축으로 그려 기울기 1의 직선에서 얼마나 벗어나는지 보세요. 평균 낼 표본 수를 바꿔 값의 흔들림이 얼마나 줄어드는지도 재어 보세요.',
    troubleshooting: [
      { symptom: '평평한 책상에서 값이 0이 아님', cause: '센서를 붙인 면이 기울었거나 센서 자체에 영점 치우침이 있습니다.', fix: '평평한 곳에서 읽은 값을 영점으로 적어 두고 모든 각도에서 그 값을 빼세요.' },
      { symptom: '화면 숫자가 쉬지 않고 바뀜', cause: '평균 낼 표본 수가 적습니다.', fix: '표본 수를 40으로 올리고 판을 단단한 책상 위에 두세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'd3-line-follower',
    title: '선 따라가는 자동차 (라인 트레이서)',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '중급',
    minutes: 65,
    sensors: ['cds'],
    actuators: ['dc-motor-driver'],
    coreKeywords: ['라인 트레이서', '좌우 차이', '되먹임', '민감도', '주행'],
    connections: lineFollowerConnections,
    sketch: lineFollowerSketch,
    tunable: { anchor: 'turnGain', name: '조향 민감도 (배)', hint: '크면 예민하게 꺾다가 좌우로 흔들립니다. 0.35에서 시작하세요.' },
    overview: '바닥을 향한 두 CDS가 읽은 밝기의 차이만큼 좌우 바퀴의 속도를 다르게 주어, 검은 선을 따라 스스로 굽어 가는 자동차를 만듭니다.',
    procedure: '흰 종이에 폭 2 cm의 검은 선을 곧게 그리고 완만한 곡선도 하나 그리세요. 민감도를 세 값으로 바꿔 같은 경로를 각각 세 번씩 달리게 하세요.',
    science: '검은 선은 빛을 덜 되돌려 보내므로 선 위에 있는 쪽 CDS의 값이 낮습니다. 두 값의 차이는 차체가 선에서 얼마나 어긋났는지를 뜻하며, 그 차이에 비례해 바퀴 속도를 바꾸면 차체가 선 쪽으로 되돌아옵니다. 비례 상수가 크면 빨리 되돌아오지만 지나쳐서 좌우로 흔들리고, 작으면 곡선에서 선을 놓칩니다.',
    safety: '모터는 별도 전원으로 돌리고, 차가 책상에서 떨어지지 않도록 바닥에서 시험하세요.',
    applicationGuide: '민감도별로 좌우 밝기 차이의 시간 그래프를 그려, 차이가 0 둘레에서 얼마나 크게 진동하는지 견주세요. 진동이 가장 작으면서 곡선을 놓치지 않는 값이 이 차체의 적정 민감도입니다.',
    troubleshooting: [
      { symptom: '차가 선을 따라가지 못하고 곧장 나감', cause: '두 CDS가 바닥에서 너무 높거나 서로 너무 붙어 있습니다.', fix: '센서를 바닥에서 5 mm 높이로 낮추고 선 폭만큼 좌우로 벌려 다세요.' },
      { symptom: '좌우로 심하게 흔들림', cause: '민감도가 큽니다.', fix: '민감도를 절반으로 줄이고 기본 속도도 함께 낮추세요.' },
      { symptom: '한쪽으로만 계속 돕니다', cause: '두 CDS의 개체 차이가 밝기 차이로 잘못 읽힌 것입니다.', fix: '흰 종이 위에서 두 값을 읽어 그 차이를 영점으로 빼세요.' },
    ],
  }),
  createPhase7Recipe({
    id: 'd4-parking-barrier',
    title: '초음파 주차 차단기',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '중급',
    minutes: 55,
    sensors: ['hc-sr04'],
    actuators: ['servo-sg90', 'buzzer'],
    coreKeywords: ['거리 감지', '이력', '자동 개폐', '경보', '떨림 방지'],
    connections: barrierConnections,
    sketch: barrierSketch,
    tunable: { anchor: 'openCm', name: '차단기를 여는 거리 (cm)', hint: '닫는 거리는 이보다 5 cm 넉넉히 잡습니다. 20 cm에서 시작하세요.' },
    overview: '초음파로 잰 거리가 정한 값보다 가까워지면 서보가 차단기를 올리고, 더 가까워지면 부저가 울리는 장치를 만들어 그 판정이 얼마나 안정적인지 확인합니다.',
    procedure: '상자를 차 대신 삼아 센서 쪽으로 천천히 밀며 차단기가 열리는 거리를 자로 재어 적으세요. 그다음 여는 거리 언저리에 상자를 세워 두고 차단기가 떨리는지 30초간 관찰하세요.',
    science: '기준이 하나뿐이면 측정값이 그 언저리에서 흔들릴 때마다 판정이 뒤집혀 장치가 떨립니다. 여는 기준과 닫는 기준을 벌려 두면 한 번 열린 상태는 확실히 멀어질 때까지 유지되는데, 이것을 이력이라 합니다. 초음파는 비스듬한 면에서 되돌아오지 않아 -1이 나오기도 하므로, 그 값을 거리로 쓰면 차단기가 갑자기 닫힙니다.',
    safety: '차단기 팔이 도는 자리에 손을 두지 마세요. 서보는 별도 전원으로 돌립니다.',
    applicationGuide: '여는 거리와 닫는 거리의 간격을 0, 2, 5, 10 cm로 바꿔 가며 30초 동안 상태가 몇 번 뒤집히는지 세어, 간격이 떨림을 얼마나 줄이는지 그래프로 보이세요.',
    troubleshooting: [
      { symptom: '차단기가 계속 여닫힘', cause: '여는 기준과 닫는 기준의 간격이 좁습니다.', fix: '간격을 5 cm 이상으로 벌리세요.' },
      { symptom: '거리가 -1로 기록됨', cause: '되돌아온 소리를 받지 못한 것입니다. 비스듬한 면이나 푹신한 물건은 소리를 되돌리지 않습니다.', fix: '평평한 판을 대상으로 삼고, -1은 거리로 쓰지 말고 그대로 남겨 두세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'd5-auto-curtain',
    title: '밝기에 따라 열리는 자동 커튼',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '중급',
    minutes: 50,
    sensors: ['tsl2591'],
    actuators: ['servo-sg90'],
    coreKeywords: ['조도 판정', '이력', '자동 제어', '기준값', '커튼'],
    connections: curtainConnections,
    sketch: curtainSketch,
    tunable: { anchor: 'openLux', name: '커튼을 여는 밝기 (lux)', hint: '닫는 밝기는 이 값의 절반으로 정해집니다. 300 lux에서 시작하세요.' },
    overview: '조도 센서가 읽은 밝기가 기준을 넘으면 서보가 커튼을 열고, 절반 아래로 내려가면 닫는 장치를 만들어 하루 동안의 동작을 기록합니다.',
    procedure: '센서를 창가에 고정하고 손전등과 손바닥으로 밝기를 오르내리게 하면서 열림과 닫힘이 바뀌는 밝기를 각각 적으세요. 그다음 창가에 두고 아침부터 저녁까지 기록을 이어 가세요.',
    science: '자연광은 구름 한 조각에도 몇 배씩 오르내립니다. 기준이 하나면 그때마다 커튼이 여닫혀 기구물이 먼저 상하므로, 여는 밝기와 닫는 밝기를 두 배 차이로 벌려 둡니다. 사람의 눈은 밝기를 대수적으로 느끼므로 두 배 차이가 눈에는 크지 않게 보입니다.',
    safety: '커튼 기구물에 손가락이 끼지 않게 하고 서보는 별도 전원으로 돌리세요.',
    applicationGuide: '기록에서 하루 동안 상태가 몇 번 바뀌었는지 세고, 여는 밝기와 닫는 밝기의 비를 1.2배와 3배로 바꿔 같은 하루를 다시 재어 횟수를 비교하세요.',
    troubleshooting: [
      { symptom: 'lux가 -1로 기록됨', cause: '센서가 측정 범위를 넘었습니다.', fix: '증폭 설정을 GAIN_LOW로 낮추고 직사광선이 바로 닿지 않게 하세요.' },
      { symptom: '구름이 지날 때마다 커튼이 움직임', cause: '두 기준의 간격이 좁습니다.', fix: '닫는 밝기를 여는 밝기의 3분의 1로 낮춰 보세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'd6-temperature-alarm',
    title: '온도 경보기',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '초급',
    minutes: 45,
    sensors: ['ds18b20'],
    actuators: ['buzzer', 'led'],
    coreKeywords: ['경보', '기준 온도', '이력', '응답 지연', '알림'],
    connections: alarmConnections,
    sketch: alarmSketch,
    tunable: { anchor: 'alarmC', name: '경보를 울리는 온도 (°C)', hint: '경보가 풀리는 온도는 이보다 1 °C 낮게 정해집니다. 30 °C에서 시작하세요.' },
    overview: '온도가 정한 값을 넘으면 부저와 LED로 알리고 1 °C 내려가야 그치는 경보기를 만들어, 기준을 넘은 시점과 실제로 울린 시점의 차이를 재어 봅니다.',
    procedure: '프로브를 따뜻한 물에 담갔다 꺼내며 울리기 시작한 시각과 그친 시각을 기록에서 찾으세요. 프로브에 얇은 비닐을 씌운 조건과 씌우지 않은 조건에서 각각 반복하세요.',
    science: '경보는 값이 기준을 넘은 순간 곧바로 울리지 않습니다. 프로브가 주변과 온도를 맞추는 데 시간이 걸리고, 그 시간은 프로브를 감싼 것이 있으면 더 길어집니다. 울리는 기준과 그치는 기준을 벌려 두는 것은 온도가 기준 언저리에서 흔들릴 때 부저가 끊어져 울리는 것을 막기 위해서입니다.',
    safety: '뜨거운 물은 화상을 입힐 수 있습니다. 50 °C를 넘기지 마세요.',
    applicationGuide: '물에 담근 시각과 경보가 울린 시각의 차이를 응답 지연으로 적고, 비닐을 씌웠을 때 그 지연이 얼마나 길어지는지 비교하세요.',
    troubleshooting: [
      { symptom: '부저가 따다닥 끊어져 울림', cause: '울리는 기준과 그치는 기준이 너무 가깝습니다.', fix: '그치는 기준을 2 °C 아래로 내려 보세요.' },
      { symptom: '경보가 울린 뒤 풀리지 않음', cause: '프로브가 아직 식지 않았습니다.', fix: '식는 데 걸리는 시간을 기록으로 확인하고, 그 시간이 너무 길면 프로브를 감싼 것을 벗기세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'd7-vibration-alarm',
    title: '진동 감지 도난 경보기',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '초급',
    minutes: 45,
    sensors: ['mpu6050'],
    actuators: ['buzzer'],
    coreKeywords: ['진동 감지', '문턱값', '발생 시점', '오검출', '유지 시간'],
    connections: vibrationConnections,
    sketch: vibrationSketch,
    tunable: { anchor: 'triggerG', name: '경보 문턱값 (g)', hint: '작을수록 예민합니다. 0.08 g에서 시작해 오검출이 생기면 올리세요.' },
    overview: '가속도 센서가 중력을 뺀 흔들림의 크기를 재고, 그 값이 문턱을 넘으면 부저를 3초간 울리는 경보기를 만들어 오검출과 놓침을 세어 봅니다.',
    procedure: '센서를 서랍이나 문에 붙이고 아무도 건드리지 않는 상태로 5분간 기록해 오검출 횟수를 세세요. 그다음 문을 살짝 여는 동작을 10회 하고 몇 번이나 울렸는지 세세요.',
    science: '가만히 있어도 센서는 중력 1 g를 읽습니다. 그 몫을 뺀 나머지가 실제 흔들림입니다. 문턱값을 낮추면 발소리에도 울리고 높이면 살짝 여는 문을 놓치므로, 이 탐구의 결론은 "얼마가 맞다"가 아니라 "오검출과 놓침을 어떤 비율로 맞바꿀 것인가"입니다.',
    applicationGuide: '문턱값을 0.03, 0.05, 0.08, 0.12 g로 바꿔 조건마다 오검출 수와 놓친 수를 세고, 두 값을 한 그래프에 그려 서로 맞바꿔지는 모습을 보이세요.',
    troubleshooting: [
      { symptom: '아무도 건드리지 않았는데 울림', cause: '문턱값이 낮아 주변 진동을 잡았습니다.', fix: '문턱값을 올리고 센서를 흔들리지 않는 면에 단단히 붙이세요.' },
      { symptom: '문을 여는데도 울리지 않음', cause: '문턱값이 높거나 표본 간격이 길어 짧은 충격을 놓쳤습니다.', fix: '표본 간격을 20 ms로 줄이고 문턱값을 한 단계 낮추세요.' },
      i2cTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'd8-elevator-floor',
    title: '층 감지 엘리베이터 모형',
    subject: '공학·로봇',
    type: 'project',
    difficulty: '고급',
    minutes: 65,
    sensors: ['hc-sr04'],
    actuators: ['servo-sg90', 'lcd1602-i2c'],
    coreKeywords: ['층 판정', '분해능', '반올림', '표시', '모형'],
    connections: elevatorConnections,
    sketch: elevatorSketch,
    tunable: { anchor: 'floorHeightCm', name: '한 층의 높이 (cm)', hint: '모형의 실제 층 간격을 자로 재어 넣으세요. 8 cm에서 시작합니다.' },
    overview: '초음파로 잰 승강기의 높이를 층 간격으로 나누어 몇 층인지 판정하고 LCD에 띄우면서, 센서의 흔들림이 층 판정을 언제 틀리게 만드는지 확인합니다.',
    procedure: '승강기 모형을 층마다 세워 두고 각 층에서 화면에 뜬 층 번호와 실제 층을 20회씩 견주어 적으세요. 층 간격을 8 cm에서 4 cm로 좁혀 같은 측정을 반복하세요.',
    science: '거리를 층 간격으로 나눠 반올림하면 층 번호가 됩니다. 이 방법은 센서의 흔들림이 층 간격의 절반보다 작을 때만 통합니다. 흔들림이 그보다 크면 같은 자리에서도 층 번호가 오르내립니다. 층을 좁힐수록 판정이 자주 틀리는 까닭이 여기에 있습니다.',
    safety: '문을 여닫는 서보 팔에 손가락이 끼지 않게 하고, 모형이 넘어지지 않도록 바닥에 고정하세요.',
    applicationGuide: '층마다 거리 20개의 표준편차를 구해 흔들림의 크기를 재고, 그 값의 두 배가 층 간격보다 커지는 지점에서 판정이 틀리기 시작하는지 확인하세요.',
    troubleshooting: [
      { symptom: '같은 자리인데 층 번호가 오르내림', cause: '센서 흔들림이 층 간격의 절반보다 큽니다.', fix: '여러 번 읽어 중앙값을 쓰거나 층 간격을 넓히세요.' },
      { symptom: '거리가 -1이 되어 층이 -1로 표시됨', cause: '되돌아온 소리를 받지 못했습니다.', fix: '반사면을 평평한 판으로 바꾸고 센서를 그 면과 나란히 맞추세요.' },
      i2cTroubleshooting,
    ],
  }),
]
