import type { Recipe, Subject, TroubleshootingItem } from '@/schema'
import { i2cConnections, makeWiring, type Connection } from './shared'

interface ProjectInput {
  id: string
  title: string
  subject: Extract<Subject, '생물' | '공학·로봇'>
  difficulty: Recipe['difficulty']
  minutes: number
  sensors: string[]
  actuators?: string[]
  coreKeywords: string[]
  connections: Connection[]
  sketch: string
  tunable: Recipe['tunables'][number]
  overview: string
  procedure: string
  science: string
  applicationGuide: string
  troubleshooting: TroubleshootingItem[]
}

function project(input: ProjectInput): Recipe {
  return {
    id: input.id,
    type: 'project',
    title: input.title,
    subject: input.subject,
    difficulty: input.difficulty,
    minutes: input.minutes,
    board: 'uno-r3',
    sensors: input.sensors,
    actuators: input.actuators ?? [],
    coreKeywords: input.coreKeywords,
    imageUrl: `wiring/${input.id}.svg`,
    imageWidth: 800,
    imageHeight: 600,
    wiring: makeWiring(input.connections),
    sketch: input.sketch,
    baudRate: 9600,
    tunables: [input.tunable],
    body: `## 탐구 목표

${input.overview}

## 측정 방법

${input.procedure}

:::callout warn
전원을 끈 상태에서 배선하세요. 모터, 서보, 릴레이에 연결한 부하는 아두이노 핀에서 직접 구동하지 말고 정격에 맞는 구동 회로와 전원을 사용하세요.
:::

:::toggle 원리·오차까지 보기
${input.science}
:::`,
    applicationGuide: input.applicationGuide,
    troubleshooting: input.troubleshooting,
    status: 'draft',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt: '2026-07-30T00:00:00.000Z',
  }
}

const i2cProblem: TroubleshootingItem = {
  symptom: 'I2C 센서가 응답하지 않거나 값이 고정됨',
  cause: 'SDA와 SCL이 바뀌었거나 센서 주소, 전원 전압, 공통 접지가 맞지 않을 수 있습니다.',
  fix: 'Uno R3의 A4=SDA, A5=SCL 배선을 확인하고 I2C 스캐너로 실제 주소를 확인하세요.',
}

const noisyProblem: TroubleshootingItem = {
  symptom: '값이 크게 튀어 조건 판정이 자주 바뀜',
  cause: '접점 불량, 전원 잡음 또는 임계값 부근의 작은 변화가 원인일 수 있습니다.',
  fix: '배선을 짧게 하고 여러 표본을 평균내며 켜는 기준과 끄는 기준을 서로 다르게 두세요.',
}

const plantGrowthSketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
Adafruit_TSL2591 light(2591);
const byte BME=0x76;
uint16_t T1; int16_t T2,T3,H2,H4,H5; byte H1,H3; int8_t H6;
float tFine=0;
// @tunable loggingIntervalMs
const unsigned long loggingIntervalMs = 5000;
byte read8(byte reg) {
  Wire.beginTransmission(BME); Wire.write(reg); Wire.endTransmission(false);
  Wire.requestFrom(BME,(byte)1); return Wire.read();
}
uint16_t read16LE(byte reg) {
  byte lo=read8(reg), hi=read8(reg+1); return ((uint16_t)hi<<8)|lo;
}
int16_t readS16LE(byte reg) { return (int16_t)read16LE(reg); }
void write8(byte reg,byte value) {
  Wire.beginTransmission(BME); Wire.write(reg); Wire.write(value); Wire.endTransmission();
}
void beginBme() {
  T1=read16LE(0x88); T2=readS16LE(0x8A); T3=readS16LE(0x8C);
  H1=read8(0xA1); H2=readS16LE(0xE1); H3=read8(0xE3);
  byte e4=read8(0xE4),e5=read8(0xE5),e6=read8(0xE6);
  H4=(int16_t)((e4<<4)|(e5&0x0f));
  H5=(int16_t)((e6<<4)|(e5>>4)); H6=(int8_t)read8(0xE7);
  if(H4&0x0800) H4|=0xf000; if(H5&0x0800) H5|=0xf000;
  write8(0xF2,1); write8(0xF4,0x27);
}
float temperatureC() {
  byte a=read8(0xFA),b=read8(0xFB),c=read8(0xFC);
  long raw=((long)a<<12)|((long)b<<4)|(c>>4);
  float v1=(raw/16384.0-T1/1024.0)*T2;
  float v2=(raw/131072.0-T1/8192.0);
  v2=v2*v2*T3; tFine=v1+v2; return tFine/5120.0;
}
float humidityPct() {
  byte hMsb=read8(0xFD),hLsb=read8(0xFE);
  long raw=((long)hMsb<<8)|hLsb;
  float h=tFine-76800.0;
  h=(raw-(H4*64.0+H5/16384.0*h))*(H2/65536.0*(1.0+H6/67108864.0*h*(1.0+H3/67108864.0*h)));
  h=h*(1.0-H1*h/524288.0); return constrain(h,0.0,100.0);
}
void setup() {
  Serial.begin(9600); Wire.begin();
  if (!light.begin()) Serial.println("# TSL2591_ERROR");
  if (read8(0xD0)!=0x60) Serial.println("# BME280_ERROR"); else beginBme();
  light.setGain(TSL2591_GAIN_LOW);
  light.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,temperature_c,humidity_pct");
}
void loop() {
  uint32_t raw = light.getFullLuminosity();
  uint16_t ir = raw >> 16, full = raw & 0xffff;
  float temperature=temperatureC();
  Serial.print(millis()); Serial.print(',');
  Serial.print(light.calculateLux(full, ir), 2); Serial.print(',');
  Serial.print(temperature, 2); Serial.print(',');
  Serial.println(humidityPct(), 2);
  delay(loggingIntervalMs);
}`

const nightActivitySketch = `// @pin PIR=D2
// @pin LIGHT=A0
// @baud 9600
const byte PIR_PIN = 2, LIGHT_PIN = A0;
// @tunable darkThreshold
int darkThreshold = 350;
unsigned long darkMotionCount = 0;
void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  Serial.println("time_ms,light_adc,motion,dark_motion_count");
  delay(30000);
}
void loop() {
  static bool lastMotion = false;
  static unsigned long lastLog = 0;
  int light = analogRead(LIGHT_PIN);
  bool motion = digitalRead(PIR_PIN) == HIGH;
  // PIR 출력은 한 번의 움직임에도 수 초간 HIGH로 유지되므로, 표본 수가 아니라
  // LOW에서 HIGH로 바뀌는 순간만 한 사건으로 셉니다.
  if (motion && !lastMotion && light < darkThreshold) darkMotionCount++;
  // 밤새 0.5초마다 출력하면 행이 수만 개가 되어 복사해 쓸 수 없습니다.
  // 상태가 바뀔 때와 60초 주기에만 기록을 남깁니다.
  if (motion != lastMotion || millis() - lastLog >= 60000) {
    lastLog = millis();
    Serial.print(millis()); Serial.print(',');
    Serial.print(light); Serial.print(',');
    Serial.print(motion); Serial.print(',');
    Serial.println(darkMotionCount);
  }
  lastMotion = motion;
  delay(500);
}`

const photosynthesisSketch = `#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin RELAY=D7
// @baud 9600
Adafruit_TSL2591 light(2591);
const byte RELAY_PIN = 7;
// @tunable targetLux
float targetLux = 500.0;
void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  if (!light.begin()) Serial.println("# TSL2591_ERROR");
  light.setGain(TSL2591_GAIN_LOW);
  light.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,lamp");
}
void loop() {
  uint32_t raw = light.getFullLuminosity();
  float lux = light.calculateLux(raw & 0xffff, raw >> 16);
  static bool lamp = false;
  static unsigned long lastSwitch = 0;
  // 조명 자신이 센서 밝기를 크게 바꾸므로, 기준 간격만으로는 릴레이가 초 단위로
  // 반복 동작해 접점이 빨리 상합니다. 최소 유지 시간을 함께 둡니다.
  if (millis() - lastSwitch >= 10000) {
    if (lux < targetLux * 0.9 && !lamp) { lamp = true; lastSwitch = millis(); }
    else if (lux > targetLux * 1.1 && lamp) { lamp = false; lastSwitch = millis(); }
  }
  digitalWrite(RELAY_PIN, lamp ? HIGH : LOW);
  Serial.print(millis()); Serial.print(',');
  Serial.print(lux, 2); Serial.print(',');
  Serial.println(lamp);
  delay(1000);
}`

const activityMeterSketch = `#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
MPU6050 imu;
// @tunable motionThresholdG
float motionThresholdG = 0.18;
unsigned long activeSamples = 0, totalSamples = 0;
void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,dynamic_g,active_fraction");
}
void loop() {
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  float dynamicG = abs(sqrt(x*x+y*y+z*z) - 1.0);
  totalSamples++;
  if (dynamicG >= motionThresholdG) activeSamples++;
  Serial.print(millis()); Serial.print(',');
  Serial.print(dynamicG, 4); Serial.print(',');
  Serial.println(activeSamples / (float)totalSamples, 4);
  delay(50);
}`

const obstacleCarSketch = `#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D8
// @pin ECHO=D9
// @pin LEFT_IN1=D2
// @pin LEFT_IN2=D4
// @pin RIGHT_IN3=D3
// @pin RIGHT_IN4=D7
// @pin LEFT_PWM=D5
// @pin RIGHT_PWM=D6
// @baud 9600
MPU6050 imu;
const byte TRIG=8,ECHO=9,LEFT_IN1=2,LEFT_IN2=4,RIGHT_IN3=3,RIGHT_IN4=7,LEFT_PWM=5,RIGHT_PWM=6;
// @tunable stopDistanceCm
float stopDistanceCm = 25.0;
float distanceCm() {
  digitalWrite(TRIG,LOW); delayMicroseconds(2);
  digitalWrite(TRIG,HIGH); delayMicroseconds(10); digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  return us ? us*0.0343/2.0 : NAN;
}
void drive(byte left, byte right) {
  // L298N은 모터 한 개당 방향 입력이 두 개입니다. 한쪽만 연결하면 나머지
  // 입력이 떠 있어 회전 방향이 정해지지 않습니다.
  digitalWrite(LEFT_IN1,HIGH); digitalWrite(LEFT_IN2,LOW);
  digitalWrite(RIGHT_IN3,HIGH); digitalWrite(RIGHT_IN4,LOW);
  analogWrite(LEFT_PWM,left); analogWrite(RIGHT_PWM,right);
}
void setup() {
  Serial.begin(9600); Wire.begin(); imu.initialize();
  pinMode(TRIG,OUTPUT); pinMode(ECHO,INPUT);
  pinMode(LEFT_IN1,OUTPUT); pinMode(LEFT_IN2,OUTPUT);
  pinMode(RIGHT_IN3,OUTPUT); pinMode(RIGHT_IN4,OUTPUT);
  pinMode(LEFT_PWM,OUTPUT); pinMode(RIGHT_PWM,OUTPUT);
  Serial.println("time_ms,distance_cm,tilt_x_g");
}
// 속도 단계 실험은 이 값을 120, 150, 180처럼 바꿔 가며 반복하세요.
byte cruiseSpeed = 150;
void loop() {
  static bool avoiding=false; static byte missedEchoes=0;
  float d=distanceCm();
  int16_t ax,ay,az; imu.getAcceleration(&ax,&ay,&az);
  // 일시적인 미수신에 바로 반응하지 않도록 nan이 세 번 이어질 때만 장애물로 봅니다.
  missedEchoes = isnan(d) ? missedEchoes+1 : 0;
  if (missedEchoes >= 3 || d < stopDistanceCm) {
    // 정지까지 이동한 거리를 잴 수 있도록 먼저 완전히 멈춘 뒤 제자리에서 회전합니다.
    if (!avoiding) { drive(0,0); delay(300); avoiding=true; }
    drive(0,cruiseSpeed);
  } else {
    avoiding=false;
    drive(cruiseSpeed,cruiseSpeed);
  }
  Serial.print(millis()); Serial.print(',');
  Serial.print(d,1); Serial.print(',');
  Serial.println(ax/16384.0,3);
  delay(80);
}`

const lightFollowSketch = `// @pin LIGHT_LEFT=A0
// @pin LIGHT_RIGHT=A1
// @pin LEFT_IN1=D2
// @pin LEFT_IN2=D4
// @pin RIGHT_IN3=D3
// @pin RIGHT_IN4=D7
// @pin LEFT_PWM=D5
// @pin RIGHT_PWM=D6
// @baud 9600
const byte LDR_L=A0,LDR_R=A1,IN_L1=2,IN_L2=4,IN_R3=3,IN_R4=7,PWM_L=5,PWM_R=6;
// @tunable deadband
int deadband = 40;
void setup() {
  Serial.begin(9600);
  pinMode(IN_L1,OUTPUT); pinMode(IN_L2,OUTPUT);
  pinMode(IN_R3,OUTPUT); pinMode(IN_R4,OUTPUT);
  pinMode(PWM_L,OUTPUT); pinMode(PWM_R,OUTPUT);
  // L298N은 모터 한 개당 방향 입력이 두 개입니다. 두 입력을 HIGH/LOW로
  // 함께 정해야 회전 방향이 확정됩니다.
  digitalWrite(IN_L1,HIGH); digitalWrite(IN_L2,LOW);
  digitalWrite(IN_R3,HIGH); digitalWrite(IN_R4,LOW);
  Serial.println("time_ms,left_adc,right_adc,error");
}
void loop() {
  int left=analogRead(LDR_L), right=analogRead(LDR_R);
  int error=left-right;
  int correction=abs(error)<deadband ? 0 : constrain(error/2,-80,80);
  analogWrite(PWM_L,constrain(150-correction,0,255));
  analogWrite(PWM_R,constrain(150+correction,0,255));
  Serial.print(millis()); Serial.print(',');
  Serial.print(left); Serial.print(',');
  Serial.print(right); Serial.print(',');
  Serial.println(error);
  delay(50);
}`

const automaticDoorSketch = `// @pin PIR=D2
// @pin SERVO=D9
// @baud 9600
const byte PIR_PIN=2,SERVO_PIN=9;
// @tunable holdOpenMs
unsigned long holdOpenMs = 3000;
unsigned long lastMotion=0;
void servoAngle(byte angle) {
  unsigned int pulse=544U+(unsigned long)angle*(2400-544)/180;
  digitalWrite(SERVO_PIN,HIGH); delayMicroseconds(pulse);
  digitalWrite(SERVO_PIN,LOW);
  // delayMicroseconds는 16383 µs까지만 정확합니다. 20 ms 프레임을 한 번에
  // 넣으면 주기가 무너지므로 나머지는 delay()로 채웁니다.
  delayMicroseconds(2400-pulse); delay(17);
}
void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN,INPUT); pinMode(SERVO_PIN,OUTPUT);
  Serial.println("time_ms,door_state");
  // PIR 안정화 약 30초 동안에도 문을 닫힌 자세로 계속 붙잡아 둡니다.
  for(unsigned int i=0;i<1500;i++) servoAngle(0);
}
void loop() {
  static bool lastOpen=false; static unsigned long lastLog=0;
  if (digitalRead(PIR_PIN)==HIGH) lastMotion=millis();
  bool open=millis()-lastMotion < holdOpenMs;
  servoAngle(open ? 90 : 0);
  // 20 ms마다 출력하면 9600 baud를 넘겨 기록이 밀립니다. 상태 변화와 1초 주기만 남깁니다.
  if (open!=lastOpen || millis()-lastLog>=1000) {
    lastOpen=open; lastLog=millis();
    Serial.print(millis()); Serial.print(',');
    Serial.println(open ? 1 : 0);
  }
}`

const parkingAlarmSketch = `// @pin TRIG=D8
// @pin ECHO=D9
// @pin BUZZER=D3
// @pin LED=D4
// @baud 9600
const byte TRIG=8,ECHO=9,BUZZER=3,LED_PIN=4;
// @tunable warningDistanceCm
float warningDistanceCm = 60.0;
void setup() {
  Serial.begin(9600); pinMode(TRIG,OUTPUT); pinMode(ECHO,INPUT);
  pinMode(BUZZER,OUTPUT); pinMode(LED_PIN,OUTPUT);
  Serial.println("time_ms,distance_cm");
}
void loop() {
  digitalWrite(TRIG,LOW); delayMicroseconds(2);
  digitalWrite(TRIG,HIGH); delayMicroseconds(10); digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  float cm=us ? us*0.0343/2.0 : NAN;
  bool warning=!isnan(cm) && cm<warningDistanceCm;
  digitalWrite(LED_PIN,warning);
  if(warning) tone(BUZZER,1200,80); else noTone(BUZZER);
  Serial.print(millis()); Serial.print(',');
  Serial.println(cm,1);
  delay(warning ? constrain((int)(cm*8),80,500) : 500);
}`

const rpmSketch = `// @pin OUT=A0
// @baud 9600
const byte HALL_PIN=A0;
const int magnetThreshold=400;
const int releaseThreshold=500;
unsigned long pulseCount=0;
// @tunable pulsesPerRevolution
unsigned int pulsesPerRevolution = 1;
void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,pulses,rpm");
}
void loop() {
  static bool magnetDetected=false;
  int hallValue=analogRead(HALL_PIN);
  if(!magnetDetected && hallValue<=magnetThreshold) {
    pulseCount++;
    magnetDetected=true;
  } else if(magnetDetected && hallValue>=releaseThreshold) {
    magnetDetected=false;
  }

  // 측정 창 실험은 이 값을 1000(1초)과 5000(5초)으로 바꿔 가며 반복하세요.
  const unsigned long windowMs = 1000;
  static unsigned long last=0;
  if(millis()-last<windowMs) return;
  unsigned long elapsed=millis()-last; last=millis();
  unsigned long pulses=pulseCount; pulseCount=0;
  float rpm=pulsesPerRevolution ? pulses*60000.0/(elapsed*pulsesPerRevolution) : 0;
  Serial.print(last); Serial.print(','); Serial.print(pulses); Serial.print(',');
  Serial.println(rpm,1);
}`

const smartLightingSketch = `// @pin PIR=D2
// @pin LIGHT=A0
// @pin RELAY=D7
// @baud 9600
const byte PIR_PIN=2,LIGHT_PIN=A0,RELAY_PIN=7;
// @tunable darkThreshold
int darkThreshold = 350;
// 끄는 기준은 켜는 기준보다 높게 두어(히스테리시스) 조명 빛이 CDS로
// 되먹임되어 생기는 빠른 반복 동작을 막습니다.
int brightThreshold = 450;
// 조명 유지 시간 실험은 이 값을 10000, 30000, 60000으로 바꿔 가며 반복하세요.
unsigned long holdOnMs = 30000;
unsigned long lastMotion=0,lastSwitch=0;
bool lamp=false;
void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN,INPUT); pinMode(RELAY_PIN,OUTPUT);
  digitalWrite(RELAY_PIN,LOW);
  // PIR 안정화를 기다리는 동안 시리얼 모니터를 연 학생이 헤더를 놓치지 않도록
  // 헤더를 먼저 출력합니다.
  Serial.println("time_ms,light_adc,occupied,lamp");
  delay(30000);
}
void loop() {
  int light=analogRead(LIGHT_PIN);
  if(digitalRead(PIR_PIN)==HIGH) lastMotion=millis();
  bool occupied=millis()-lastMotion<holdOnMs;
  // 릴레이 보호를 위해 상태를 바꾼 뒤 10초 동안은 다시 바꾸지 않습니다.
  if (millis()-lastSwitch>=10000) {
    if (!lamp && occupied && light<darkThreshold) { lamp=true; lastSwitch=millis(); }
    else if (lamp && (!occupied || light>brightThreshold)) { lamp=false; lastSwitch=millis(); }
  }
  digitalWrite(RELAY_PIN,lamp ? HIGH : LOW);
  Serial.print(millis());Serial.print(',');
  Serial.print(light);Serial.print(',');
  Serial.print(occupied);Serial.print(',');
  Serial.println(lamp);
  delay(250);
}`

export const biologyProjectRecipes: Recipe[] = [
  project({
    id: 'plant-growth',
    title: '식물 생장 환경 기록기',
    subject: '생물',
    difficulty: '중급',
    minutes: 50,
    sensors: ['tsl2591', 'bme280'],
    coreKeywords: ['식물', '생장', '조도', '온도', '습도', '환경'],
    connections: [...i2cConnections('TSL2591'), ...i2cConnections('BME280')],
    sketch: plantGrowthSketch,
    tunable: { anchor: 'loggingIntervalMs', name: '기록 간격 (ms)', hint: '장기 관찰에서는 수 분 단위로 늘리세요.' },
    overview: '식물 주변의 조도, 온도, 상대습도를 같은 시각에 기록하고 생장 길이·잎 수처럼 별도로 관찰한 생장 지표와 비교합니다.',
    procedure: '센서를 잎에 가려지지 않고 물이 닿지 않는 위치에 고정합니다. 매일 같은 시각에 생장 지표를 직접 측정하고, 센서 로그는 일평균뿐 아니라 밝은 시간의 누적 시간도 계산합니다.',
    science: '환경 센서는 생장을 직접 측정하지 않습니다. 조도는 광합성에 이용되는 광합성유효복사(PAR)와 같지 않고, 상대습도는 온도에 의존합니다. 따라서 관찰된 상관관계를 한 요인의 인과효과로 단정하지 말고 식물 종류, 물, 토양을 통제해야 합니다.',
    applicationGuide: '빛 조건만 다르게 한 두 화분을 두고 물과 온도를 최대한 같게 유지하여 생장률과 일일 조도 노출을 비교하세요.',
    troubleshooting: [i2cProblem, { symptom: '조도값이 비정상적으로 크거나 NaN으로 표시됨', cause: '강한 직사광선이 센서의 측정 범위를 넘어 값이 최댓값에 머물렀을 수 있습니다.', fix: '신호 증폭 정도와 빛을 모아 측정하는 시간을 낮추고 센서에 그림자가 생기지 않도록 위치를 조정하세요.' }],
  }),
  project({
    id: 'night-activity',
    title: '야행성 활동 감지',
    subject: '생물',
    difficulty: '초급',
    minutes: 40,
    sensors: ['hc-sr501', 'cds'],
    coreKeywords: ['야행성', '활동', 'PIR', '조도', '행동'],
    connections: [
      { from: 'HC-SR501.VCC', to: 'UNO.5V', color: 'red', text: 'PIR VCC를 5V에 연결하세요.' },
      { from: 'HC-SR501.GND', to: 'UNO.GND', color: 'black', text: 'PIR GND를 공통 GND에 연결하세요.' },
      { from: 'HC-SR501.OUT', to: 'UNO.D2', color: 'yellow', text: 'PIR OUT을 D2에 연결하세요.' },
      { from: 'CDS.L1', to: 'UNO.5V', color: 'red', text: 'CDS의 한쪽 다리 L1을 5V에 연결하세요.' },
      { from: 'CDS.L2', to: 'CDS_RESISTOR.1', color: 'blue', text: 'CDS의 다른 다리 L2를 10 kΩ 분압 저항 한쪽과 연결하세요.' },
      { from: 'CDS_RESISTOR.1', to: 'UNO.A0', color: 'blue', text: 'L2와 저항이 만나는 전압 측정 지점을 A0에 연결하세요.' },
      { from: 'CDS_RESISTOR.2', to: 'UNO.GND', color: 'black', text: '10 kΩ 분압 저항의 다른 쪽을 GND에 연결하세요.' },
    ],
    sketch: nightActivitySketch,
    tunable: { anchor: 'darkThreshold', name: '어두움 기준값 (ADC 값)', hint: '설치 장소의 낮과 밤에 아날로그 전압을 숫자로 바꾼 값(ADC 값)을 먼저 기록해 중간값으로 정하세요.' },
    overview: 'PIR의 움직임 사건과 CDS의 상대 밝기를 함께 기록해 어두운 시간대의 활동 빈도를 비교합니다.',
    procedure: 'PIR 전원 투입 후 안정화 시간을 기다리고 감지 범위를 비운 상태에서 기준값을 확인합니다. 동일 개체를 여러 밤 관찰하되 강제 조명이나 소음으로 행동을 유도하지 않습니다.',
    science: '인체 움직임 감지용 적외선 센서(PIR 센서)는 동물의 존재나 개체 수가 아니라 시야 구역 사이의 적외선 변화만 알아냅니다. 한 번의 긴 움직임이 여러 표본으로 집계될 수 있으므로 신호가 LOW에서 HIGH로 바뀌는 순간을 한 사건으로 세는 방식과 단순 표본 수를 구분해야 합니다. CDS 값은 보정 전에는 lux가 아닌 상대 밝기입니다.',
    applicationGuide: '1분 구간별로 움직임 사건을 묶고 밝은 시간과 어두운 시간의 활동률을 비교하되, 동물 복지를 해치는 조건 변화는 하지 마세요.',
    troubleshooting: [{ symptom: '아무 움직임이 없어도 PIR가 계속 감지됨', cause: '안정화 전이거나 햇빛, 난방기, 뜨거운 공기 흐름이 시야에 있을 수 있습니다.', fix: '30초 이상 안정화하고 열원에서 센서 방향을 돌리며 감도 노브를 낮추세요.' }, noisyProblem],
  }),
  project({
    id: 'photosynthesis-light-control',
    title: '광합성 조건 탐구 (조도 제어)',
    subject: '생물',
    difficulty: '고급',
    minutes: 60,
    sensors: ['tsl2591'],
    actuators: ['relay-module', 'led'],
    coreKeywords: ['광합성', '조도', 'TSL2591', '릴레이', 'LED', '대조군'],
    connections: [
      ...i2cConnections('TSL2591'),
      { from: 'RELAY.VCC', to: 'UNO.5V', color: 'red', text: '릴레이 모듈 VCC를 5V에 연결하세요.' },
      { from: 'RELAY.GND', to: 'UNO.GND', color: 'black', text: '릴레이 모듈 GND를 공통 GND에 연결하세요.' },
      { from: 'RELAY.IN', to: 'UNO.D7', color: 'orange', text: '릴레이 제어 IN을 D7에 연결하세요.' },
      { from: 'LED_SUPPLY.+', to: 'RELAY.COM', color: 'red', text: '정격에 맞는 LED 별도 전원 양극을 릴레이 COM에 연결하세요.' },
      { from: 'RELAY.NO', to: 'LED.+', color: 'purple', text: '릴레이 NO를 식물용 LED 전원의 양극 입력에 연결하세요.' },
      { from: 'LED.-', to: 'LED_SUPPLY.-', color: 'black', text: 'LED 음극을 별도 전원 음극에 연결하세요.' },
    ],
    sketch: photosynthesisSketch,
    tunable: { anchor: 'targetLux', name: '목표 조도 (lux)', hint: '센서의 측정 범위를 넘지 않고 식물에 무리가 없는 범위에서 설정하세요.' },
    overview: '센서 위치의 조도를 일정 범위로 제어하고, 조명이 다른 대조 조건과 식물의 생장 또는 잎 상태를 비교합니다.',
    procedure: '센서를 잎 높이에 두고 릴레이로 저전압 LED 전원만 스위칭합니다. 물, 온도, 식물 크기를 같게 맞춘 대조군을 두고 충분한 기간 동안 반복 측정합니다.',
    science: 'lux는 사람 눈의 밝기 감도 기준이며 식물이 받는 빛 입자의 수를 나타내는 값(PPFD)이 아닙니다. 이 실험은 동일 광원 안에서의 상대 비교에 적합합니다. 켜는 기준과 끄는 기준을 서로 다르게 두면 기준값 근처에서 릴레이가 빠르게 켜졌다 꺼지는 반복 동작을 줄일 수 있습니다.',
    applicationGuide: '목표 조도를 여러 수준으로 나누되 광주기와 총 노출 시간을 함께 기록하고, 생장 차이를 단일 측정으로 결론내리지 마세요.',
    troubleshooting: [i2cProblem, { symptom: '릴레이가 빠르게 반복 동작함', cause: '조도가 목표값 근처에서 흔들리거나 센서가 LED 빛을 직접 받아 양의 피드백이 생길 수 있습니다.', fix: '센서 위치를 고정하고 켜짐·꺼짐 임계값 간격을 넓히며 최소 동작 시간을 추가하세요.' }],
  }),
  project({
    id: 'human-activity-meter',
    title: '사람의 활동량 측정',
    subject: '생물',
    difficulty: '중급',
    minutes: 45,
    sensors: ['mpu6050'],
    coreKeywords: ['활동량', '가속도', 'MPU6050', '움직임', '표본'],
    connections: i2cConnections('MPU6050'),
    sketch: activityMeterSketch,
    tunable: { anchor: 'motionThresholdG', name: '활동 임계값 (g)', hint: '착용 위치별 정지 잡음을 측정한 뒤 그보다 충분히 크게 정하세요.' },
    overview: '착용한 MPU6050의 가속도 크기에서 중력 성분을 근사적으로 제거해, 임계값을 넘은 표본 비율을 상대 활동 지표로 기록합니다.',
    procedure: '센서를 몸에 단단히 고정하고 같은 착용 위치에서 정지, 걷기, 빠르게 걷기를 각각 반복합니다. 활동 종류별 지표 분포를 비교하고 개인 간 절댓값 비교는 피합니다.',
    science: '가속도 크기에서 1 g를 뺀 값은 단순 활동 지표이지 에너지 소비량이나 걸음 수가 아닙니다. 센서 방향에는 비교적 둔감하지만 회전, 충격, 착용 위치와 표본 주파수에 크게 영향을 받습니다. 의료 진단값으로 사용하면 안 됩니다.',
    applicationGuide: '같은 사람이 같은 위치에 착용한 조건에서 활동 종류별 중앙값과 변동 범위를 비교하고 충분한 휴식 시간을 두세요.',
    troubleshooting: [i2cProblem, { symptom: '가만히 있어도 활동 지표가 큼', cause: '센서가 헐겁거나 영점·감도 오차와 진동이 포함되었을 수 있습니다.', fix: '센서를 단단히 고정하고 정지 상태 분포를 먼저 기록한 뒤 임계값을 조정하세요.' }],
  }),
]

export const roboticsProjectRecipes: Recipe[] = [
  project({
    id: 'obstacle-avoid-car',
    title: '장애물 회피 자율주행 자동차',
    subject: '공학·로봇',
    difficulty: '고급',
    minutes: 80,
    sensors: ['hc-sr04', 'mpu6050'],
    actuators: ['dc-motor-driver'],
    coreKeywords: ['장애물', '멈추는', '피하는', '자율주행', '초음파', '거리', 'MPU6050', '모터'],
    connections: [
      ...i2cConnections('MPU6050'),
      { from: 'HC-SR04.VCC', to: 'UNO.5V', color: 'red', text: '초음파 센서 VCC를 5V에 연결하세요.' },
      { from: 'HC-SR04.GND', to: 'UNO.GND', color: 'black', text: '초음파 센서 GND를 공통 GND에 연결하세요.' },
      { from: 'HC-SR04.TRIG', to: 'UNO.D8', color: 'blue', text: 'TRIG를 D8에 연결하세요.' },
      { from: 'HC-SR04.ECHO', to: 'UNO.D9', color: 'green', text: 'ECHO를 D9에 연결하세요.' },
      { from: 'DRIVER.IN1', to: 'UNO.D2', color: 'orange', text: '왼쪽 모터 방향 입력 IN1을 D2에 연결하세요.' },
      { from: 'DRIVER.IN2', to: 'UNO.D4', color: 'orange', text: '왼쪽 모터 방향 입력 IN2를 D4에 연결하세요. 모터 한 개에는 방향 입력이 두 개 모두 필요합니다.' },
      { from: 'DRIVER.IN3', to: 'UNO.D3', color: 'purple', text: '오른쪽 모터 방향 입력 IN3을 D3에 연결하세요.' },
      { from: 'DRIVER.IN4', to: 'UNO.D7', color: 'purple', text: '오른쪽 모터 방향 입력 IN4를 D7에 연결하세요.' },
      { from: 'DRIVER.ENA', to: 'UNO.D5', color: 'yellow', text: '왼쪽 모터 PWM 입력 ENA를 D5에 연결하세요.' },
      { from: 'DRIVER.ENB', to: 'UNO.D6', color: 'white', text: '오른쪽 모터 PWM 입력 ENB를 D6에 연결하세요.' },
      { from: 'BATTERY.+', to: 'DRIVER.VM', color: 'red', text: '모터 정격에 맞는 외부 전원 양극을 드라이버 VM에 연결하세요.' },
      { from: 'BATTERY.-', to: 'DRIVER.GND', color: 'black', text: '외부 전원 음극을 드라이버 GND에 연결하세요.' },
      { from: 'DRIVER.GND', to: 'UNO.GND', color: 'black', text: '드라이버와 Uno의 GND를 공통으로 연결하세요.' },
    ],
    sketch: obstacleCarSketch,
    tunable: { anchor: 'stopDistanceCm', name: '회피 시작 거리 (cm)', hint: '차량 속도와 정지거리를 고려해 여유 있게 설정하세요.' },
    overview: '초음파 거리로 전방 장애물을 감지해 좌우 모터 속도를 바꾸고, MPU6050의 기울기 값을 함께 기록해 주행 상태를 관찰합니다.',
    procedure: '모터 드라이버의 5V-EN 점퍼(또는 별도 5V 논리 전원)가 연결되어 있는지 먼저 확인합니다. 바퀴를 지면에서 띄운 상태에서 방향과 정지 동작을 확인한 뒤, 넓고 평평한 구역에서 낮은 속도로 시작해 여러 재질과 각도의 장애물에 대한 검출 실패를 기록합니다. 센서의 측정 범위(약 4 m)를 넘는 빈 공간에서는 미검출을 장애물로 보고 제자리 회전을 하므로, 시험 주행은 벽에서 4 m 안쪽에서 시작합니다.',
    science: '초음파는 부드럽거나 비스듬한 표면에서 반사가 센서로 돌아오지 않을 수 있습니다. 단일 전방 센서만으로는 측면과 낭떠러지를 알 수 없고 MPU6050도 절대 위치를 제공하지 않습니다. 따라서 이 예제는 안전 기능이 아닌 제한된 교실 실험입니다.',
    applicationGuide: '속도별 정지거리보다 회피 임계값이 충분히 큰지 측정하고, 반사 재질별 미검출률을 표로 비교하세요.',
    troubleshooting: [{ symptom: '모터를 켜면 센서가 재시작하거나 값이 튐', cause: '모터 돌입전류와 브러시 잡음이 Uno 전원에 유입될 수 있습니다.', fix: '모터는 외부 전원으로 구동하고 GND만 공유하며 디커플링과 짧은 배선을 사용하세요.' }, noisyProblem],
  }),
  project({
    id: 'light-follow-car',
    title: '빛을 따라가는 자동차',
    subject: '공학·로봇',
    difficulty: '중급',
    minutes: 65,
    sensors: ['cds'],
    actuators: ['dc-motor-driver'],
    coreKeywords: ['빛', '자동차', '조도', 'CDS', '차동제어'],
    connections: [
      { from: 'CDS_1.L1', to: 'UNO.5V', color: 'red', text: '왼쪽 CDS의 L1을 5V에 연결하세요.' },
      { from: 'CDS_1.L2', to: 'CDS_RESISTOR_1.1', color: 'blue', text: '왼쪽 CDS의 L2를 왼쪽 10 kΩ 분압 저항과 연결하세요.' },
      { from: 'CDS_RESISTOR_1.1', to: 'UNO.A0', color: 'blue', text: '왼쪽 두 저항 사이의 전압 측정 지점을 A0에 연결하세요.' },
      { from: 'CDS_RESISTOR_1.2', to: 'UNO.GND', color: 'black', text: '왼쪽 분압 저항의 다른 쪽을 GND에 연결하세요.' },
      { from: 'CDS_2.L1', to: 'UNO.5V', color: 'red', text: '오른쪽 CDS의 L1을 5V에 연결하세요.' },
      { from: 'CDS_2.L2', to: 'CDS_RESISTOR_2.1', color: 'green', text: '오른쪽 CDS의 L2를 오른쪽 10 kΩ 분압 저항과 연결하세요.' },
      { from: 'CDS_RESISTOR_2.1', to: 'UNO.A1', color: 'green', text: '오른쪽 두 저항 사이의 전압 측정 지점을 A1에 연결하세요.' },
      { from: 'CDS_RESISTOR_2.2', to: 'UNO.GND', color: 'black', text: '오른쪽 분압 저항의 다른 쪽을 GND에 연결하세요.' },
      { from: 'DRIVER.IN1', to: 'UNO.D2', color: 'orange', text: '왼쪽 모터 방향 입력 IN1을 D2에 연결하세요.' },
      { from: 'DRIVER.IN2', to: 'UNO.D4', color: 'orange', text: '왼쪽 모터 방향 입력 IN2를 D4에 연결하세요. 모터 한 개에는 방향 입력이 두 개 모두 필요합니다.' },
      { from: 'DRIVER.IN3', to: 'UNO.D3', color: 'purple', text: '오른쪽 모터 방향 입력 IN3을 D3에 연결하세요.' },
      { from: 'DRIVER.IN4', to: 'UNO.D7', color: 'purple', text: '오른쪽 모터 방향 입력 IN4를 D7에 연결하세요.' },
      { from: 'DRIVER.ENA', to: 'UNO.D5', color: 'yellow', text: '왼쪽 PWM(ENA)을 D5에 연결하세요.' },
      { from: 'DRIVER.ENB', to: 'UNO.D6', color: 'white', text: '오른쪽 PWM(ENB)을 D6에 연결하세요.' },
      { from: 'BATTERY.+', to: 'DRIVER.VM', color: 'red', text: '모터용 외부 전원 양극을 드라이버 VM에 연결하세요.' },
      { from: 'BATTERY.-', to: 'DRIVER.GND', color: 'black', text: '외부 전원 음극을 드라이버 GND에 연결하세요.' },
      { from: 'DRIVER.GND', to: 'UNO.GND', color: 'black', text: '드라이버와 Uno의 GND를 공통으로 연결하세요.' },
    ],
    sketch: lightFollowSketch,
    tunable: { anchor: 'deadband', name: '좌우 밝기 무시 범위 (ADC 값)', hint: '정면 조명에서 떨지 않을 만큼 크게 설정하세요.' },
    overview: '좌우 CDS의 상대 밝기 차이를 두 모터의 속도 차이로 바꾸어 밝은 방향으로 조향합니다.',
    procedure: '모터 드라이버의 5V-EN 점퍼(또는 별도 5V 논리 전원)가 연결되어 있는지 먼저 확인합니다. 두 센서를 같은 각도와 높이에 좌우 대칭으로 설치합니다. 정면의 균일한 빛에서 두 센서 오프셋을 기록한 뒤, 낮은 속도로 광원의 위치를 바꾸며 오차와 회전 방향을 확인합니다.',
    science: 'CDS에서 아날로그 전압을 숫자로 바꾼 값(ADC 값)은 lux가 아니며 두 저항의 연결 방향에 따라 밝을수록 값이 커지거나 작아질 수 있습니다. 센서 편차와 주변 반사광 때문에 영점 보정이 필요하고, 작은 차이에는 반응하지 않는 범위를 두면 조향 진동을 줄일 수 있습니다.',
    applicationGuide: '센서 사이 간격과 차광판 길이를 바꾸며 방향 오차와 추종 안정성을 비교하세요.',
    troubleshooting: [{ symptom: '빛과 반대 방향으로 회전함', cause: 'CDS의 두 저항 연결 방향 또는 좌우 모터·센서 대응이 코드 가정과 반대일 수 있습니다.', fix: '각 센서를 손으로 가려 ADC 값의 변화 방향을 확인하고 좌우 보정 부호 또는 모터 연결을 바꾸세요.' }, noisyProblem],
  }),
  project({
    id: 'automatic-door',
    title: '자동 개폐 문',
    subject: '공학·로봇',
    difficulty: '중급',
    minutes: 50,
    sensors: ['hc-sr501'],
    actuators: ['servo-sg90'],
    coreKeywords: ['자동문', 'PIR', '서보', '인체감지', '상태제어'],
    connections: [
      { from: 'HC-SR501.VCC', to: 'UNO.5V', color: 'red', text: 'PIR VCC를 5V에 연결하세요.' },
      { from: 'HC-SR501.GND', to: 'UNO.GND', color: 'black', text: 'PIR GND를 공통 GND에 연결하세요.' },
      { from: 'HC-SR501.OUT', to: 'UNO.D2', color: 'yellow', text: 'PIR OUT을 D2에 연결하세요.' },
      { from: 'SERVO.SIGNAL', to: 'UNO.D9', color: 'orange', text: '서보 신호선을 D9에 연결하세요.' },
      { from: 'SERVO.VCC', to: 'SERVO_SUPPLY.+', color: 'red', text: '서보 VCC를 정격 5V 별도 전원 양극에 연결하세요.' },
      { from: 'SERVO.GND', to: 'SERVO_SUPPLY.-', color: 'black', text: '서보 GND를 별도 전원 음극에 연결하세요.' },
      { from: 'SERVO_SUPPLY.-', to: 'UNO.GND', color: 'black', text: '별도 전원 GND와 Uno GND를 공통으로 연결하세요.' },
    ],
    sketch: automaticDoorSketch,
    tunable: { anchor: 'holdOpenMs', name: '문 열림 유지 시간 (ms)', hint: '통과에 필요한 시간보다 짧지 않게 설정하세요.' },
    overview: 'PIR 움직임 신호가 들어오면 서보로 모형 문을 열고, 마지막 감지 뒤 일정 시간 동안 열린 상태를 유지합니다.',
    procedure: '서보 혼을 분리한 채 0°와 90° 동작을 먼저 확인한 후 기구물의 실제 한계각 안에서 연결합니다. 손이 끼이지 않는 가벼운 모형 문에서만 시험합니다. PIR 모듈의 출력 유지 시간(Tx) 노브는 최소로 돌려 두고, 실제 열림 유지 시간은 그 Tx에 holdOpenMs를 더한 값으로 기록합니다.',
    science: 'PIR은 접근 거리나 정지한 사람을 알 수 없습니다. 시간 유지 방식은 출력이 잠시 끊겨도 바로 닫히는 것을 막지만, 실제 자동문에는 광전식 안전센서, 힘 제한, 비상 개방 등 중복 안전장치가 필요합니다.',
    applicationGuide: '접근 방향별 감지 성공률과 필요한 열림 유지 시간을 측정하되 실제 출입문 제어에는 사용하지 마세요.',
    troubleshooting: [{ symptom: '서보가 떨거나 Uno가 재시작함', cause: '서보 전류를 Uno 5V 핀에서 공급했거나 공통 GND가 빠졌을 수 있습니다.', fix: '서보는 충분한 별도 5V 전원으로 공급하고 전원 GND와 Uno GND를 연결하세요.' }, { symptom: '문이 끝에서 걸리며 소리가 남', cause: '명령 각도가 기구물의 물리적 이동 범위를 넘었을 수 있습니다.', fix: '전원을 끄고 링크를 풀어 걸림을 제거한 뒤 열림·닫힘 각도를 더 좁게 조정하세요.' }],
  }),
  project({
    id: 'parking-alarm',
    title: '주차 보조 거리 경보기',
    subject: '공학·로봇',
    difficulty: '초급',
    minutes: 40,
    sensors: ['hc-sr04'],
    actuators: ['buzzer', 'led'],
    coreKeywords: ['주차', '거리', '경보', '초음파', '부저', 'LED'],
    connections: [
      { from: 'HC-SR04.VCC', to: 'UNO.5V', color: 'red', text: 'HC-SR04 VCC를 5V에 연결하세요.' },
      { from: 'HC-SR04.GND', to: 'UNO.GND', color: 'black', text: 'HC-SR04 GND를 공통 GND에 연결하세요.' },
      { from: 'HC-SR04.TRIG', to: 'UNO.D8', color: 'blue', text: 'TRIG를 D8에 연결하세요.' },
      { from: 'HC-SR04.ECHO', to: 'UNO.D9', color: 'green', text: 'ECHO를 D9에 연결하세요.' },
      { from: 'BUZZER.SIGNAL', to: 'UNO.D3', color: 'purple', text: '부저 신호선을 D3에 연결하세요.' },
      { from: 'BUZZER.GND', to: 'UNO.GND', color: 'black', text: '부저 GND를 공통 GND에 연결하세요.' },
      // 저항을 안내 문장에만 적어 두면 회로도에도, 준비물 목록에도 나오지 않아
      // 학생이 LED를 D4에 그대로 꽂습니다. 꽂아야 할 부품은 배선 단계로 선언합니다.
      { from: 'RESISTOR_220.1', to: 'UNO.D4', color: 'orange', text: '220 Ω 저항의 한쪽 다리를 D4에 연결하세요.' },
      { from: 'LED.ANODE', to: 'RESISTOR_220.2', color: 'orange', text: 'LED의 긴 다리(양극)를 220 Ω 저항의 남은 다리와 같은 브레드보드 열에 꽂으세요. 이 저항이 없으면 LED에 너무 큰 전류가 흘러 LED가 타 버립니다.' },
      { from: 'LED.CATHODE', to: 'UNO.GND', color: 'black', text: 'LED의 짧은 다리(음극)를 GND에 연결하세요.' },
    ],
    sketch: parkingAlarmSketch,
    tunable: { anchor: 'warningDistanceCm', name: '경보 시작 거리 (cm)', hint: '센서 오차와 실제 정지거리를 더한 값보다 크게 설정하세요.' },
    overview: '초음파 거리 측정값이 가까워질수록 부저 간격을 짧게 하고 LED를 켜는 모형 주차 경보기를 만듭니다.',
    procedure: '자를 놓고 여러 거리에서 측정값을 확인한 뒤 경보 임계값을 정합니다. 차량이 아닌 손으로 표적을 움직여 경보 패턴을 시험합니다.',
    science: '거리는 초음파 왕복시간에 음속을 곱한 뒤 2로 나눕니다. 온도와 표면 각도·재질이 오차를 만들며, 미수신을 0 cm로 해석하면 위험한 오경보 또는 무경보가 생깁니다. 이 모형은 실제 주차 안전장치를 대체하지 않습니다.',
    applicationGuide: '평판, 천, 기울어진 판에서 거리 오차와 미수신률을 비교해 경보 여유거리를 정하세요.',
    troubleshooting: [{ symptom: '거리가 0 또는 NaN으로 표시됨', cause: '제한시간 안에 반사파가 돌아오지 않았거나 TRIG/ECHO 배선이 바뀌었을 수 있습니다.', fix: '배선을 확인하고 평평한 판을 센서 정면의 측정 범위 안에 놓으세요.' }, noisyProblem],
  }),
  project({
    id: 'rpm-meter',
    title: '바퀴 회전수(RPM) 측정기',
    subject: '공학·로봇',
    difficulty: '중급',
    minutes: 45,
    sensors: ['hbe0704'],
    coreKeywords: ['RPM', '회전수', '홀센서', '자석', '임계값'],
    connections: [
      { from: 'HBE0704.VCC', to: 'UNO.5V', color: 'red', text: '홀 센서 모듈 VCC를 사양에 맞춰 5V에 연결하세요.' },
      { from: 'HBE0704.GND', to: 'UNO.GND', color: 'black', text: '홀 센서 GND를 공통 GND에 연결하세요.' },
      { from: 'HBE0704.OUT', to: 'UNO.A0', color: 'green', text: '홀 센서의 아날로그 출력 OUT을 A0에 연결하세요.' },
    ],
    sketch: rpmSketch,
    tunable: { anchor: 'pulsesPerRevolution', name: '회전당 펄스 수 (개)', hint: '바퀴 한 바퀴에 센서를 지나는 자석 수와 같게 설정하세요.' },
    overview: '바퀴의 자석이 홀 센서를 지날 때 아날로그 값이 임계값을 넘는 에지를 세어 일정 시간 동안의 분당 회전수(RPM)를 계산합니다.',
    procedure: '바퀴를 손으로 천천히 한 바퀴 돌려 펄스 수를 확인한 뒤 회전당 자석 수를 설정합니다. 자석을 단단히 고정하고 회전체에서 충분히 떨어져 시험합니다. 같은 속도를 오래 유지해야 하는 측정은 손 대신 자석을 붙인 선풍기 날개나 소형 모터처럼 일정하게 도는 회전체로 하세요.',
    science: 'RPM은 펄스 수×60을 측정시간(초)과 회전당 펄스 수로 나눈 값입니다. 낮은 속도에서는 짧은 측정 시간 때문에 생기는 회전수 반올림 오차가 크므로 펄스 사이 주기를 재는 방법이 더 정밀할 수 있습니다. HBE0704의 아날로그 OUT은 진입 기준과 해제 기준을 다르게 두어 신호가 기준을 넘는 순간을 찾고, 자석이 한 번 통과할 때 한 펄스로 셉니다.',
    applicationGuide: '1초와 5초 측정 창에서 응답속도와 RPM 변동을 비교하고 기준 회전계가 있으면 보정하세요.',
    troubleshooting: [{ symptom: '한 번 통과할 때 펄스가 여러 번 증가함', cause: '자석 경계에서 아날로그 값이 흔들리거나 진입·해제 임계값 간격이 좁을 수 있습니다.', fix: '센서와 자석 간격을 조정하고 magnetThreshold와 releaseThreshold 간격을 넓히세요.' }, { symptom: '회전해도 펄스가 없음', cause: '자석 방향·거리가 맞지 않거나 실제 A0 값이 코드의 임계값을 통과하지 않을 수 있습니다.', fix: '자석을 가까이 대기 전후의 A0 값을 기록하고 두 임계값을 그 범위 사이로 조정하세요.' }],
  }),
  project({
    id: 'smart-lighting',
    title: '스마트 조명',
    subject: '공학·로봇',
    difficulty: '중급',
    minutes: 50,
    sensors: ['hc-sr501', 'cds'],
    actuators: ['relay-module'],
    coreKeywords: ['스마트조명', 'PIR', 'CDS', '릴레이', '자동제어'],
    connections: [
      { from: 'HC-SR501.VCC', to: 'UNO.5V', color: 'red', text: 'PIR VCC를 5V에 연결하세요.' },
      { from: 'HC-SR501.GND', to: 'UNO.GND', color: 'black', text: 'PIR GND를 공통 GND에 연결하세요.' },
      { from: 'HC-SR501.OUT', to: 'UNO.D2', color: 'yellow', text: 'PIR OUT을 D2에 연결하세요.' },
      { from: 'CDS.L1', to: 'UNO.5V', color: 'red', text: 'CDS의 L1을 5V에 연결하세요.' },
      { from: 'CDS.L2', to: 'CDS_RESISTOR.1', color: 'blue', text: 'CDS의 L2를 10 kΩ 분압 저항 한쪽과 연결하세요.' },
      { from: 'CDS_RESISTOR.1', to: 'UNO.A0', color: 'blue', text: 'L2와 저항이 만나는 전압 측정 지점을 A0에 연결하세요.' },
      { from: 'CDS_RESISTOR.2', to: 'UNO.GND', color: 'black', text: '10 kΩ 분압 저항의 다른 쪽을 GND에 연결하세요.' },
      { from: 'RELAY.VCC', to: 'UNO.5V', color: 'red', text: '릴레이 모듈 VCC를 5V에 연결하세요.' },
      { from: 'RELAY.GND', to: 'UNO.GND', color: 'black', text: '릴레이 모듈 GND를 공통 GND에 연결하세요.' },
      { from: 'RELAY.IN', to: 'UNO.D7', color: 'orange', text: '릴레이 IN을 D7에 연결하세요.' },
      { from: 'LAMP_SUPPLY.+', to: 'RELAY.COM', color: 'red', text: '안전한 저전압 조명용 별도 전원 양극을 릴레이 COM에 연결하세요.' },
      { from: 'RELAY.NO', to: 'LAMP.+', color: 'purple', text: '릴레이 NO를 저전압 조명 양극에 연결하세요.' },
      { from: 'LAMP.-', to: 'LAMP_SUPPLY.-', color: 'black', text: '저전압 조명 음극을 별도 전원 음극에 연결하세요.' },
    ],
    sketch: smartLightingSketch,
    tunable: { anchor: 'darkThreshold', name: '어두움 임계값 (ADC 값)', hint: '설치 위치의 낮과 밤 값을 측정해 중간 범위로 정하세요.' },
    overview: '사람의 움직임이 최근에 감지되었고 주변이 어두울 때만 저전압 조명을 켜는 논리 제어를 구현합니다.',
    procedure: 'CDS의 밝고 어두울 때 ADC 값을 먼저 기록하고 인체 움직임 감지용 적외선 센서(PIR 센서)가 안정된 뒤 점등 조건을 확인합니다. 릴레이 접점에는 교실용 안전 저전압 부하만 연결합니다. 조명 빛이 CDS에 직접 닿지 않도록 가림판을 두고, 실험 중에는 실제로 사람이 있었던 시간을 관찰 노트에 함께 적어 둡니다.',
    science: 'PIR의 HIGH는 재실을 완전히 증명하지 않으며 정지한 사람을 놓칠 수 있습니다. CDS는 상대 밝기만 제공하므로 설치 위치에서 임계값을 보정해야 합니다. 이중 조건은 불필요한 점등을 줄이지만 오검출과 미검출을 제거하지는 않습니다.',
    applicationGuide: '유지 시간을 10초, 30초, 60초로 바꾸며 불필요 점등 시간과 사용 중 꺼짐 횟수를 함께 비교하세요.',
    troubleshooting: [{ symptom: '밝은데도 조명이 켜짐', cause: 'CDS의 두 저항 연결 방향이 코드 가정과 반대거나 기준값이 설치 환경에 맞지 않을 수 있습니다.', fix: '밝고 어두울 때 ADC 값을 확인해 비교 방향과 기준값을 조정하세요.' }, { symptom: '사람이 가만히 있으면 조명이 꺼짐', cause: 'PIR 센서는 온도 변화가 없는 정지 상태를 감지하지 못합니다.', fix: '켜진 상태를 유지하는 시간을 늘리되 실제 재실 제어에는 다른 센서와 수동 스위치를 함께 사용하세요.' }],
  }),
]

export const bioRoboticsProjectRecipes: Recipe[] = [
  ...biologyProjectRecipes,
  ...roboticsProjectRecipes,
]
