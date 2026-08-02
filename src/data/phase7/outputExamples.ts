import type { Recipe } from '@/schema'
import {
  contactTroubleshooting,
  createPhase7Recipe,
  externalSupplyTroubleshooting,
  i2cTroubleshooting,
  type Connection,
} from './shared'

/**
 * 출력 장치 기초 예제 6건.
 *
 * 센서 예제 10건은 모두 "값을 읽어 시리얼로 내보내기"였습니다. 처음 온 학생이
 * LED 하나를 켜려 해도 참고할 자리가 없었고, 재고에 있는 LCD1602는 78건
 * 어디에서도 쓰이지 않았습니다. 여기서는 **아두이노가 무언가를 움직이게 하는
 * 쪽**을 한 장치씩 다룹니다.
 */

/** TSL2591의 전체광 채널을 레지스터에서 직접 읽습니다. 라이브러리 없이 씁니다. */
const tslReadDriver = `uint16_t lightRaw() {
  Wire.beginTransmission(0x29); Wire.write(0xB4); Wire.endTransmission(false);
  Wire.requestFrom(0x29, (byte)2);
  // 한 식 안에서 두 번 읽으면 순서가 정해지지 않아 바이트가 뒤바뀝니다.
  byte low = Wire.read(); byte high = Wire.read();
  return (uint16_t)low | ((uint16_t)high << 8);
}`

const ledSketch = `#include <Wire.h>

// @pin LED=D9
// @baud 9600

const byte LED_PIN = 9;
// 한 밝기 단계를 유지하는 시간입니다. 조도센서가 안정될 만큼 길게 두세요.
// @tunable stepHoldMs
int stepHoldMs = 2000;

${tslReadDriver}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(LED_PIN, OUTPUT);
  // 조도센서를 켜고 100 ms 동안 빛을 모으도록 설정합니다.
  Wire.beginTransmission(0x29); Wire.write(0xA0); Wire.write(0x03); Wire.endTransmission();
  Serial.println("time_ms,pwm_value,light_raw");
}

void loop() {
  // analogWrite는 0~255 사이의 값으로 켜져 있는 시간의 비율을 바꿉니다.
  // 사람 눈에는 밝기가 변한 것처럼 보이지만 실제로는 빠르게 껐다 켜는 것입니다.
  for (int pwm = 0; pwm <= 255; pwm += 51) {
    analogWrite(LED_PIN, pwm);
    delay(stepHoldMs);
    Serial.print(millis()); Serial.print(',');
    Serial.print(pwm); Serial.print(',');
    Serial.println(lightRaw());
  }
}
`

const buzzerSketch = `// @pin BUZZER=D8
// @baud 9600

const byte BUZZER_PIN = 8;
// 내보낼 소리의 높이입니다. 값이 클수록 높은 소리가 납니다.
// @tunable toneHz
int toneHz = 880;

void setup() {
  Serial.begin(9600);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("time_ms,tone_hz,buzzer_on");
}

void loop() {
  // tone()은 정해진 높이의 소리를 계속 냅니다. noTone()으로 멈춥니다.
  tone(BUZZER_PIN, toneHz);
  Serial.print(millis()); Serial.print(',');
  Serial.print(toneHz); Serial.println(",1");
  delay(500);

  noTone(BUZZER_PIN);
  Serial.print(millis()); Serial.print(',');
  Serial.print(toneHz); Serial.println(",0");
  delay(500);
}
`

const servoSketch = `#include <Servo.h>

// @pin SERVO=D9
// @baud 9600

Servo horn;
// 한 각도에서 멈춰 있는 시간입니다. 기구물이 무거우면 늘리세요.
// @tunable holdMs
int holdMs = 1000;

void setup() {
  Serial.begin(9600);
  horn.attach(9);
  Serial.println("time_ms,commanded_deg");
}

void loop() {
  // 서보는 "몇 도로 가라"는 명령만 받습니다. 실제로 그 각도에 닿았는지는
  // 알려 주지 않으므로, 기구물이 걸리면 명령과 실제 각도가 달라집니다.
  for (int angle = 0; angle <= 180; angle += 30) {
    horn.write(angle);
    Serial.print(millis()); Serial.print(',');
    Serial.println(angle);
    delay(holdMs);
  }
}
`

const relaySketch = `// @pin RELAY=D7
// @baud 9600

const byte RELAY_PIN = 7;
// 팬을 켜 두는 시간입니다. 접점을 아끼려면 너무 짧게 두지 마세요.
// @tunable onSeconds
int onSeconds = 5;

void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  // 시작할 때 반드시 꺼진 상태로 둡니다. 전원이 들어오자마자 팬이 도는 것을 막습니다.
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("time_ms,relay_state");
}

void loop() {
  digitalWrite(RELAY_PIN, HIGH);
  Serial.print(millis()); Serial.println(",1");
  delay((unsigned long)onSeconds * 1000);

  digitalWrite(RELAY_PIN, LOW);
  Serial.print(millis()); Serial.println(",0");
  delay((unsigned long)onSeconds * 1000);
}
`

const motorSketch = `// @pin IN1=D2
// @pin IN2=D4
// @pin ENA=D5
// @baud 9600

const byte IN1 = 2, IN2 = 4, ENA = 5;
// 시험할 속도 값입니다. 0은 정지, 255가 가장 빠릅니다.
// @tunable testSpeed
int testSpeed = 160;

void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT); pinMode(ENA, OUTPUT);
  Serial.println("time_ms,direction,speed_value");
}

void report(const char* direction, int speed) {
  Serial.print(millis()); Serial.print(',');
  Serial.print(direction); Serial.print(',');
  Serial.println(speed);
}

void loop() {
  // 방향은 IN1과 IN2의 조합이 정하고, 속도는 ENA에 보내는 값이 정합니다.
  // 둘 다 HIGH이거나 둘 다 LOW이면 모터가 멈춥니다.
  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);
  analogWrite(ENA, testSpeed);
  report("forward", testSpeed);
  delay(2000);

  analogWrite(ENA, 0);
  report("stop", 0);
  delay(1000);

  digitalWrite(IN1, LOW); digitalWrite(IN2, HIGH);
  analogWrite(ENA, testSpeed);
  report("reverse", testSpeed);
  delay(2000);

  analogWrite(ENA, 0);
  report("stop", 0);
  delay(1000);
}
`

const lcdSketch = `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

LiquidCrystal_I2C lcd(0x27, 16, 2);
OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 화면을 새로 쓰는 간격입니다. 너무 짧으면 글자가 깜빡여 읽기 어렵습니다.
// @tunable refreshMs
int refreshMs = 1000;

void setup() {
  Serial.begin(9600);
  lcd.init();
  lcd.backlight();
  probe.begin();
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  float celsius = probe.getTempCByIndex(0);

  // 자리를 지우지 않고 덮어쓰면 앞 값의 남은 글자가 붙어 25.5가 25.55처럼 보입니다.
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Water temp");
  lcd.setCursor(0, 1);
  lcd.print(celsius, 1);
  lcd.print(" C");

  Serial.print(millis()); Serial.print(',');
  Serial.println(celsius, 2);
  delay(refreshMs);
}
`

const ledConnections: Connection[] = [
  { from: 'RESISTOR_220.1', to: 'UNO.D9', color: 'orange', text: '220 Ω 저항의 한쪽 다리를 D9에 연결하세요.' },
  { from: 'LED.ANODE', to: 'RESISTOR_220.2', color: 'orange', text: 'LED의 긴 다리(양극)를 220 Ω 저항의 남은 다리와 같은 브레드보드 열에 꽂으세요. 이 저항이 없으면 LED가 타 버립니다.' },
  { from: 'LED.CATHODE', to: 'UNO.GND', color: 'black', text: 'LED의 짧은 다리(음극)를 GND에 연결하세요.' },
  { from: 'TSL2591.VIN', to: 'UNO.5V', color: 'red', text: 'TSL2591 VIN을 아두이노 5V에 연결하세요.' },
  { from: 'TSL2591.GND', to: 'UNO.GND', color: 'black', text: 'TSL2591 GND를 아두이노 GND에 연결하세요.' },
  { from: 'TSL2591.SDA', to: 'UNO.A4', color: 'green', text: 'TSL2591 SDA를 아두이노 A4에 연결하세요.' },
  { from: 'TSL2591.SCL', to: 'UNO.A5', color: 'yellow', text: 'TSL2591 SCL을 아두이노 A5에 연결하세요.' },
]

const buzzerConnections: Connection[] = [
  { from: 'BUZZER.SIGNAL', to: 'UNO.D8', color: 'purple', text: '부저의 신호선(+ 표시가 있는 쪽)을 D8에 연결하세요.' },
  { from: 'BUZZER.GND', to: 'UNO.GND', color: 'black', text: '부저의 남은 다리를 GND에 연결하세요.' },
]

const servoConnections: Connection[] = [
  { from: 'SERVO.SIGNAL', to: 'UNO.D9', color: 'orange', text: '서보의 주황색 신호선을 D9에 연결하세요.' },
  { from: 'SERVO.VCC', to: 'SERVO_SUPPLY.+', color: 'red', text: '서보의 빨간 선을 별도 5V 전원의 + 단자에 연결하세요.' },
  { from: 'SERVO.GND', to: 'SERVO_SUPPLY.-', color: 'black', text: '서보의 갈색 선을 별도 전원의 - 단자에 연결하세요.' },
  { from: 'SERVO_SUPPLY.-', to: 'UNO.GND', color: 'black', text: '별도 전원의 - 단자를 아두이노 GND와 공통으로 묶으세요. 이 선이 없으면 서보가 신호를 알아듣지 못합니다.' },
]

const relayConnections: Connection[] = [
  { from: 'RELAY.IN', to: 'UNO.D7', color: 'orange', text: '릴레이 모듈의 IN을 D7에 연결하세요.' },
  { from: 'RELAY.VCC', to: 'UNO.5V', color: 'red', text: '릴레이 모듈의 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'RELAY.GND', to: 'UNO.GND', color: 'black', text: '릴레이 모듈의 GND를 아두이노 GND에 연결하세요.' },
  { from: 'FAN_SUPPLY.+', to: 'RELAY.COM', color: 'red', text: '팬 정격에 맞는 별도 5V 전원의 + 단자를 릴레이 COM에 연결하세요.' },
  { from: 'RELAY.NO', to: 'FAN.POSITIVE', color: 'purple', text: '릴레이 NO를 팬의 + 선에 연결하세요. 릴레이가 켜지면 COM과 NO가 붙습니다.' },
  { from: 'FAN.NEGATIVE', to: 'FAN_SUPPLY.-', color: 'black', text: '팬의 - 선을 별도 전원의 - 단자에 연결해 회로를 닫으세요.' },
]

const motorConnections: Connection[] = [
  { from: 'DRIVER.IN1', to: 'UNO.D2', color: 'orange', text: '모터 드라이버의 IN1을 D2에 연결하세요.' },
  { from: 'DRIVER.IN2', to: 'UNO.D4', color: 'orange', text: '모터 드라이버의 IN2를 D4에 연결하세요. 방향 입력은 두 개가 모두 있어야 합니다.' },
  { from: 'DRIVER.ENA', to: 'UNO.D5', color: 'yellow', text: '속도를 정하는 ENA를 D5에 연결하세요.' },
  { from: 'BATTERY.+', to: 'DRIVER.VM', color: 'red', text: '모터 정격에 맞는 별도 전원의 + 단자를 드라이버 VM에 연결하세요.' },
  { from: 'BATTERY.-', to: 'DRIVER.GND', color: 'black', text: '별도 전원의 - 단자를 드라이버 GND에 연결하세요.' },
  { from: 'DRIVER.GND', to: 'UNO.GND', color: 'black', text: '드라이버 GND와 아두이노 GND를 공통으로 묶으세요.' },
]

const lcdConnections: Connection[] = [
  { from: 'LCD.VCC', to: 'UNO.5V', color: 'red', text: 'LCD 뒤에 붙은 I2C 변환 보드의 VCC를 아두이노 5V에 연결하세요.' },
  { from: 'LCD.GND', to: 'UNO.GND', color: 'black', text: 'I2C 변환 보드의 GND를 아두이노 GND에 연결하세요.' },
  { from: 'LCD.SDA', to: 'UNO.A4', color: 'green', text: 'I2C 변환 보드의 SDA를 아두이노 A4에 연결하세요.' },
  { from: 'LCD.SCL', to: 'UNO.A5', color: 'yellow', text: 'I2C 변환 보드의 SCL을 아두이노 A5에 연결하세요.' },
  { from: 'DS18B20.VCC', to: 'UNO.5V', color: 'red', text: 'DS18B20의 빨간 선을 아두이노 5V에 연결하세요.' },
  { from: 'DS18B20.GND', to: 'UNO.GND', color: 'black', text: 'DS18B20의 검은 선을 아두이노 GND에 연결하세요.' },
  { from: 'DS18B20.DATA', to: 'UNO.D4', color: 'green', text: 'DS18B20의 노란 선(DATA)을 D4에 연결하세요.' },
  { from: 'DS18B20.DATA', to: 'RESISTOR_4700.1', color: 'green', text: 'DATA와 4.7 kΩ 저항의 한쪽 다리를 같은 브레드보드 열에 꽂으세요.' },
  { from: 'RESISTOR_4700.2', to: 'UNO.5V', color: 'red', text: '4.7 kΩ 저항의 남은 다리를 5V에 연결하세요. 이 저항이 없으면 온도를 읽지 못합니다.' },
]

export const phase7OutputExamples: Recipe[] = [
  createPhase7Recipe({
    id: 'a1-led-brightness',
    title: 'LED 켜고 끄기와 밝기 조절',
    subject: null,
    type: 'sensor-example',
    difficulty: '초급',
    minutes: 30,
    sensors: ['tsl2591'],
    actuators: ['led'],
    coreKeywords: ['LED', '밝기', 'PWM', '저항', '출력'],
    connections: ledConnections,
    sketch: ledSketch,
    tunable: { anchor: 'stepHoldMs', name: '단계 유지 시간 (ms)', hint: '조도센서 값이 안정될 만큼 길게 두세요. 2000 ms에서 시작합니다.' },
    overview: '아두이노가 LED에 보내는 값(0~255)을 단계별로 바꾸고, 그때 조도센서가 읽은 실제 밝기를 함께 기록합니다.',
    procedure: '방을 어둡게 하고 조도센서를 LED 바로 앞 같은 거리에 고정하세요. 한 바퀴가 끝날 때까지 센서와 LED를 움직이지 마세요.',
    science: 'analogWrite는 전압을 낮추는 것이 아니라 아주 빠르게 껐다 켜는 시간의 비율을 바꿉니다. 사람 눈은 그 깜빡임을 평균으로 느껴 밝기가 변한 것처럼 봅니다. 그래서 보낸 값과 실제 빛의 세기가 정비례하지 않을 수 있습니다.',
    safety: 'LED는 반드시 220 Ω 저항을 거쳐 연결하세요. 저항 없이 꽂으면 LED와 핀이 함께 상합니다.',
    applicationGuide: '보낸 값을 가로축, 조도센서 값을 세로축으로 그려 두 값이 직선 위에 놓이는지 확인하세요. 사람 눈으로 느낀 밝기 순서와도 비교해 보세요.',
    troubleshooting: [
      { symptom: 'LED가 아예 켜지지 않음', cause: 'LED의 긴 다리와 짧은 다리가 뒤바뀌었을 수 있습니다.', fix: 'LED를 빼서 긴 다리가 저항 쪽, 짧은 다리가 GND 쪽인지 확인하고 다시 꽂으세요.' },
      i2cTroubleshooting,
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'a2-buzzer-tone',
    title: '부저로 소리와 경보음 만들기',
    subject: null,
    type: 'sensor-example',
    difficulty: '초급',
    minutes: 25,
    actuators: ['buzzer'],
    coreKeywords: ['부저', '소리', '진동수', '경보', '출력'],
    connections: buzzerConnections,
    sketch: buzzerSketch,
    tunable: { anchor: 'toneHz', name: '소리의 높이 (Hz)', hint: '값이 클수록 높은 소리가 납니다. 220, 440, 880으로 바꿔 들어 보세요.' },
    overview: '부저에 보내는 진동수를 바꿔 가며 소리의 높이가 어떻게 달라지는지 듣고, 켜짐과 꺼짐을 시각과 함께 기록합니다.',
    procedure: '진동수를 220, 440, 880, 1760으로 바꾸며 각각 업로드해 소리를 들어 보세요. 두 배로 올릴 때마다 한 옥타브가 올라간 것처럼 들리는지 확인하세요.',
    science: '부저 안의 얇은 판이 1초에 몇 번 떨리는지가 소리의 높이를 정합니다. 이 수를 진동수라 하고 단위는 Hz입니다. 사람은 대략 20 Hz에서 20000 Hz 사이를 듣지만, 작은 부저는 정해진 좁은 범위에서만 제대로 울립니다.',
    safety: '부저를 귀에 가까이 대지 마세요. 작은 부저도 가까이서는 꽤 큽니다.',
    applicationGuide: '진동수를 두 배씩 올려 가며 같은 음이름으로 들리는 지점을 찾고, 부저가 가장 크게 울리는 진동수를 찾아보세요.',
    troubleshooting: [
      { symptom: '소리가 전혀 나지 않음', cause: '부저의 극성이 뒤바뀌었거나 신호선이 다른 핀에 꽂혔을 수 있습니다.', fix: '+ 표시가 있는 다리를 D8에, 남은 다리를 GND에 연결했는지 확인하세요.' },
      { symptom: '소리가 아주 작음', cause: '스스로 소리를 만드는 능동 부저가 아니라 신호를 그대로 받는 수동 부저일 수 있습니다.', fix: '수동 부저라면 tone()이 필요하고, 능동 부저라면 digitalWrite만으로도 울립니다. 두 방식을 모두 시험해 보세요.' },
      contactTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'a3-servo-angle',
    title: '서보모터에 각도 지시하기',
    subject: null,
    type: 'sensor-example',
    difficulty: '초급',
    minutes: 30,
    actuators: ['servo-sg90'],
    coreKeywords: ['서보', '각도', '모터', '기구물', '출력'],
    connections: servoConnections,
    sketch: servoSketch,
    tunable: { anchor: 'holdMs', name: '각도 유지 시간 (ms)', hint: '기구물이 무거우면 값을 늘려 서보가 도착할 시간을 주세요.' },
    overview: '서보에 0도부터 180도까지 각도를 차례로 지시하고, 명령한 각도와 실제로 멈춘 각도를 눈으로 비교합니다.',
    procedure: '서보 혼(팔)을 끼우지 않은 채 먼저 돌려 보세요. 그다음 혼을 끼우고 각도기를 옆에 대어 명령한 각도와 실제 각도를 각 단계에서 적으세요.',
    science: '서보는 "몇 도로 가라"는 명령만 받고 실제로 도착했는지는 알려 주지 않습니다. 기구물이 걸리거나 힘이 모자라면 명령과 실제가 어긋나는데, 코드만 봐서는 알 수 없습니다. SG90의 실제 이동 범위는 개체마다 조금씩 다릅니다.',
    safety: '서보를 아두이노 5V 핀으로 돌리지 마세요. 순간 전류가 커서 보드가 다시 시작됩니다. 손가락이 낄 수 있는 기구물에 연결하지 마세요.',
    applicationGuide: '명령한 각도를 가로축, 각도기로 읽은 각도를 세로축으로 그려 어느 구간에서 어긋나기 시작하는지 찾아보세요.',
    troubleshooting: [
      { symptom: '서보가 떨기만 하고 돌지 않음', cause: '전원이 모자라거나 별도 전원과 아두이노의 GND가 이어지지 않았습니다.', fix: '서보 전원을 별도 5V에서 가져오고 그 - 단자를 아두이노 GND와 공통으로 묶으세요.' },
      { symptom: '끝에서 소리가 나며 멈춤', cause: '기구물의 실제 이동 범위를 넘는 각도를 명령했습니다.', fix: '전원을 끄고 혼을 뺀 뒤 명령 범위를 좁혀 다시 시험하세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'a4-relay-switch',
    title: '릴레이로 별도 전원 장치 켜기',
    subject: null,
    type: 'sensor-example',
    difficulty: '중급',
    minutes: 35,
    actuators: ['relay-module', 'dc-fan-5v'],
    coreKeywords: ['릴레이', '접점', '별도 전원', '스위치', '출력'],
    connections: relayConnections,
    sketch: relaySketch,
    tunable: { anchor: 'onSeconds', name: '켜 두는 시간 (초)', hint: '접점을 아끼려면 1초보다 짧게 두지 마세요.' },
    overview: '아두이노의 작은 신호로 릴레이의 접점을 붙였다 떼어, 아두이노와 전기적으로 분리된 별도 전원의 팬을 켜고 끕니다.',
    procedure: '팬을 연결하기 전에 릴레이만 연결해 딸깍 소리와 표시등으로 접점이 움직이는지 먼저 확인하세요. 그다음 팬을 접점 쪽에 연결하세요.',
    science: '릴레이는 전자석으로 금속 접점을 당겨 붙이는 스위치입니다. 아두이노 쪽 회로와 접점 쪽 회로가 서로 떨어져 있어, 아두이노가 감당할 수 없는 전류의 장치도 켤 수 있습니다. COM은 공통 단자, NO는 평소 떨어져 있다가 켜지면 붙는 단자입니다.',
    safety: '접점 쪽에는 교실용 저전압 장치만 연결하세요. 가정용 콘센트 전원은 절대 연결하지 마세요.',
    applicationGuide: '켜고 끄는 간격을 바꿔 가며 접점이 붙는 소리와 팬이 실제로 돌기 시작하는 시점 사이의 지연을 재어 보세요.',
    troubleshooting: [
      { symptom: '딸깍 소리는 나는데 팬이 돌지 않음', cause: '팬 전원이 접점 회로에 들어 있지 않거나 COM/NO 배선이 잘못되었습니다.', fix: '별도 전원 + → COM, NO → 팬 +, 팬 − → 전원 − 경로가 모두 이어졌는지 확인하세요.' },
      { symptom: '반대로 동작함', cause: '많은 저가 릴레이 모듈은 IN이 LOW일 때 접점이 붙는 방식(액티브 로우)입니다.', fix: '모듈 표기를 확인하고 액티브 로우라면 digitalWrite의 HIGH와 LOW를 서로 바꾸세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'a5-dc-motor-drive',
    title: 'DC모터 속도와 방향 바꾸기',
    subject: null,
    type: 'sensor-example',
    difficulty: '중급',
    minutes: 35,
    actuators: ['dc-motor-driver'],
    coreKeywords: ['DC모터', '드라이버', '속도', '방향', '출력'],
    connections: motorConnections,
    sketch: motorSketch,
    tunable: { anchor: 'testSpeed', name: '시험 속도 값 (0~255)', hint: '너무 낮으면 모터가 소리만 내고 돌지 않습니다. 120부터 올려 보세요.' },
    overview: '모터 드라이버의 방향 입력 두 개와 속도 입력 하나를 바꿔 가며 모터가 도는 방향과 빠르기가 어떻게 달라지는지 확인합니다.',
    procedure: '바퀴를 빼거나 차체를 컵 위에 올려 모터를 공중에 띄운 상태에서 시험하세요. 속도 값을 0부터 조금씩 올려 모터가 실제로 돌기 시작하는 값을 찾으세요.',
    science: '드라이버는 아두이노의 약한 신호를 받아 별도 전원의 큰 전류를 모터로 흘려 줍니다. 방향은 두 입력의 조합이, 빠르기는 켜져 있는 시간의 비율이 정합니다. 값이 작으면 모터를 돌릴 힘이 모자라 소리만 나고 멈춰 있습니다.',
    safety: '모터는 반드시 별도 전원으로 돌리고 아두이노와는 GND만 공통으로 묶으세요. 돌아가는 축에 옷이나 머리카락이 닿지 않게 하세요.',
    applicationGuide: '속도 값을 조금씩 올리며 모터가 돌기 시작하는 최소값을 찾고, 바퀴를 달았을 때와 뗐을 때 그 값이 어떻게 달라지는지 비교하세요.',
    troubleshooting: [
      { symptom: '모터가 소리만 내고 돌지 않음', cause: '속도 값이 모터를 움직일 힘에 못 미칩니다.', fix: '속도 값을 조금씩 올려 실제로 돌기 시작하는 값을 찾으세요.' },
      { symptom: '모터를 켜면 아두이노가 다시 시작됨', cause: '모터 전류를 아두이노 5V에서 끌어 썼습니다.', fix: '모터 전원을 별도 전원으로 옮기고 GND만 공통으로 묶으세요.' },
      externalSupplyTroubleshooting,
    ],
  }),
  createPhase7Recipe({
    id: 'a6-lcd-display',
    title: 'LCD1602에 측정값 표시하기',
    subject: null,
    type: 'sensor-example',
    difficulty: '초급',
    minutes: 35,
    sensors: ['ds18b20'],
    actuators: ['lcd1602-i2c'],
    coreKeywords: ['LCD', '표시', 'I2C', '측정값', '출력'],
    connections: lcdConnections,
    sketch: lcdSketch,
    tunable: { anchor: 'refreshMs', name: '화면 갱신 간격 (ms)', hint: '너무 짧으면 글자가 깜빡여 읽기 어렵습니다. 1000 ms에서 시작하세요.' },
    overview: '온도 센서가 읽은 값을 컴퓨터 없이도 볼 수 있도록 LCD 화면에 띄우고, 같은 값을 시리얼로도 함께 내보냅니다.',
    procedure: '화면에 글자가 보이지 않으면 LCD 뒤쪽 파란 부품을 작은 드라이버로 돌려 밝기를 맞추세요. 프로브를 손으로 쥐었다 놓으며 화면의 숫자가 따라 변하는지 확인하세요.',
    science: 'LCD를 직접 연결하려면 선이 열두 가닥 넘게 필요하지만, 뒤에 붙은 I2C 변환 보드가 그것을 네 가닥으로 줄여 줍니다. 대신 그 보드마다 주소가 0x27이나 0x3F로 달라, 코드의 주소가 맞지 않으면 아무것도 나오지 않습니다.',
    applicationGuide: '측정한 값의 최고와 최저를 함께 화면에 띄우거나, 기준을 넘으면 글자가 바뀌도록 고쳐 보세요.',
    troubleshooting: [
      { symptom: '화면이 켜지지만 글자가 없음', cause: '글자 밝기가 너무 낮거나 I2C 주소가 다릅니다.', fix: 'LCD 뒤 파란 부품을 돌려 밝기를 맞추고, I2C 스캐너로 주소가 0x27인지 0x3F인지 확인해 코드에 적으세요.' },
      { symptom: '숫자 뒤에 이상한 글자가 남음', cause: '앞서 쓴 더 긴 값의 글자가 지워지지 않았습니다.', fix: '값을 쓰기 전에 lcd.clear()를 부르거나 빈칸을 덧붙여 자리를 덮으세요.' },
      i2cTroubleshooting,
    ],
  }),
]
