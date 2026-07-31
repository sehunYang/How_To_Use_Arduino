import type { Recipe, TroubleshootingItem, WiringStep } from '@/schema'
import { bme280Driver, e2Sketch, e6Sketch, oneWireDriver } from '@/data/phase5/sketches'

export type Phase6Difficulty = '초급' | '중급' | '고급'

export interface Phase6RecipeDefinition {
  id: string
  title: string
  difficulty: Phase6Difficulty
  minutes: number
  sensors: string[]
  sensorTokens?: string[]
  keywords: string[]
  law: string
  method: string
  graph: string
  apparatus: string
  safety?: string
  connections?: Connection[]
  sketch?: string
}

export interface Connection {
  from: string
  to: string
  color: string
  text: string
}

const sensorTokenById: Record<string, string> = {
  ina219: 'INA219',
  tsl2591: 'TSL2591',
  mpu6050: 'MPU6050',
  bme280: 'BME280',
  ds18b20: 'DS18B20',
  tca9548a: 'TCA9548A',
  cds: 'CDS',
  'hc-sr501': 'HC-SR501',
  'hc-sr04': 'HC-SR04',
  hbe0704: 'HBE0704',
}

function focus(index: number) {
  return {
    x: 30 + (index % 5) * 190,
    y: 30 + Math.floor(index / 5) * 105,
    w: 165,
    h: 78,
  }
}

export function makeWiring(connections: Connection[]): WiringStep[] {
  return connections.map((connection, index) => ({ ...connection, focus: focus(index) }))
}

function i2c(token: string, powerPin: 'VCC' | 'VIN' = 'VCC'): Connection[] {
  return [
    { from: `${token}.${powerPin}`, to: 'UNO.5V', color: 'red', text: `${token} ${powerPin}을 브레드보드 + 전원 레일에 연결하세요.` },
    { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 브레드보드 - 전원 레일에 연결하세요.` },
    { from: `${token}.SDA`, to: 'UNO.A4', color: 'green', text: `${token} SDA를 UNO A4(SDA)에 연결하세요.` },
    { from: `${token}.SCL`, to: 'UNO.A5', color: 'yellow', text: `${token} SCL을 UNO A5(SCL)에 연결하세요.` },
  ]
}

function defaultConnections(definition: Phase6RecipeDefinition): Connection[] {
  const instanceCounts = new Map<string, number>()
  const tokens = definition.sensorTokens ?? definition.sensors.map((id) => {
    const count = (instanceCounts.get(id) ?? 0) + 1
    instanceCounts.set(id, count)
    const base = sensorTokenById[id]
    return count === 1 ? base : `${base}_${count}`
  })
  const connections: Connection[] = []
  const ds18b20Tokens = tokens.filter((token) => token.replace(/_\d+$/, '') === 'DS18B20')

  tokens.forEach((token, index) => {
    const base = token.replace(/_\d+$/, '')
    if (base === 'MPU6050' || base === 'BME280') {
      connections.push(...i2c(token))
    } else if (base === 'TSL2591' || base === 'TCA9548A') {
      connections.push(...i2c(token, 'VIN'))
    } else if (base === 'INA219') {
      connections.push(
        ...i2c(token),
        { from: `${token}.VIN+`, to: 'BATTERY.+', color: 'red', text: `${token} VIN+를 실험 전원의 + 단자에 연결하세요.` },
        { from: `${token}.VIN-`, to: 'RESISTOR_220.1', color: 'orange', text: `${token} VIN-를 220 Ω 측정 저항 1번 단자에 연결하세요.` },
        { from: 'RESISTOR_220.2', to: 'BATTERY.-', color: 'black', text: '220 Ω 측정 저항 2번 단자와 실험 전원의 - 단자를 브레드보드 - 전원 레일에 연결하세요.' },
        { from: 'BATTERY.-', to: 'UNO.GND', color: 'black', text: '실험 전원의 - 단자를 브레드보드 - 전원 레일을 통해 UNO GND와 공통 접지하세요.' },
      )
    } else if (base === 'DS18B20') {
      connections.push(
        { from: `${token}.VCC`, to: 'UNO.5V', color: 'red', text: `${token} VCC를 브레드보드 + 전원 레일에 연결하세요.` },
        { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 브레드보드 - 전원 레일에 연결하세요.` },
        token === ds18b20Tokens[0]
          ? { from: `${token}.DATA`, to: 'UNO.D2', color: 'green', text: `${token} DATA를 UNO D2 공통 1-Wire 버스에 연결하세요.` }
          : { from: `${token}.DATA`, to: `${ds18b20Tokens[0]}.DATA`, color: 'green', text: `${token} DATA를 첫 DS18B20 DATA와 같은 브레드보드 열에 연결하세요.` },
      )
    } else if (base === 'HC-SR04') {
      connections.push(
        { from: `${token}.VCC`, to: 'UNO.5V', color: 'red', text: `${token} VCC를 브레드보드 + 전원 레일에 연결하세요.` },
        { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 브레드보드 - 전원 레일에 연결하세요.` },
        { from: `${token}.TRIG`, to: 'UNO.D7', color: 'blue', text: `${token} TRIG를 UNO D7에 연결하세요.` },
        { from: `${token}.ECHO`, to: 'UNO.D6', color: 'green', text: `${token} ECHO를 UNO D6에 연결하세요.` },
      )
    } else if (base === 'HBE0704') {
      connections.push(
        { from: `${token}.VCC`, to: 'UNO.5V', color: 'red', text: `${token} VCC를 브레드보드 + 전원 레일에 연결하세요.` },
        { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 브레드보드 - 전원 레일에 연결하세요.` },
        { from: `${token}.OUT`, to: `UNO.A${Math.min(index, 3)}`, color: 'blue', text: `${token} OUT을 UNO 아날로그 입력에 연결하세요.` },
      )
    } else if (base === 'CDS') {
      const resistor = `CDS_RESISTOR_${index + 1}`
      connections.push(
        { from: `${token}.L1`, to: 'UNO.5V', color: 'red', text: `${token} L1을 브레드보드 + 전원 레일에 연결하세요.` },
        { from: `${token}.L2`, to: `UNO.A${Math.min(index, 3)}`, color: 'blue', text: `${token} L2 분압점에서 아날로그 값을 읽으세요.` },
        { from: `${token}.L2`, to: `${resistor}.1`, color: 'blue', text: `${token} L2와 10 kΩ 저항 1번 단자를 같은 브레드보드 열에 연결하세요.` },
        { from: `${resistor}.2`, to: 'UNO.GND', color: 'black', text: '10 kΩ 저항 2번 단자를 브레드보드 - 전원 레일에 연결하세요.' },
      )
    }
  })
  const firstDs18b20 = tokens.find((token) => token.replace(/_\d+$/, '') === 'DS18B20')
  if (firstDs18b20) {
    connections.push(
      { from: `${firstDs18b20}.DATA`, to: 'RESISTOR_4700.1', color: 'green', text: `${firstDs18b20} DATA와 4.7 kΩ 풀업 저항 1번 단자를 같은 브레드보드 열에 연결하세요.` },
      { from: 'RESISTOR_4700.2', to: 'UNO.5V', color: 'red', text: '4.7 kΩ 풀업 저항 2번 단자를 브레드보드 + 전원 레일에 연결하세요.' },
    )
  }
  return connections
}

const troubleshooting: TroubleshootingItem[] = [
  {
    symptom: '측정값이 나오지 않거나 일정하게 고정됨',
    cause: '전원 레일, 공통 GND, 센서 신호선 또는 코드의 핀 설정이 실제 배선과 다를 수 있습니다.',
    fix: 'UNO 5V→BB.tp.1과 UNO GND→BB.tn.1부터 확인한 뒤 배선 단계 순서대로 신호선을 점검하세요.',
  },
  {
    symptom: '그래프에 큰 잡음이나 비현실적인 급변이 나타남',
    cause: '접촉 불량, 센서 고정 불량, 표본 간격 또는 실험 외 교란 변수가 원인일 수 있습니다.',
    fix: '센서를 단단히 고정하고 같은 조건에서 3회 이상 반복한 뒤 중앙값과 불확도를 함께 기록하세요.',
  },
]

function genericSketch(definition: Phase6RecipeDefinition): string {
  const sensors = new Set(definition.sensors)
  const header = `// ${definition.title}
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;
`
  if (sensors.has('hc-sr04') && sensors.has('bme280')) {
    return `#include <Wire.h>
${header}
${bme280Driver}
const byte TRIG_PIN=7,ECHO_PIN=6;
void setup(){Serial.begin(9600);Wire.begin();bmeBegin();pinMode(TRIG_PIN,OUTPUT);pinMode(ECHO_PIN,INPUT);}
void loop(){
  digitalWrite(TRIG_PIN,LOW);delayMicroseconds(2);digitalWrite(TRIG_PIN,HIGH);delayMicroseconds(10);digitalWrite(TRIG_PIN,LOW);
  unsigned long us=pulseIn(ECHO_PIN,HIGH,30000);float t=bmeTemperatureC(),p=bmePressureHpa();
  float soundSpeed=331.3f+0.606f*t,distanceM=us*soundSpeed/2000000.0f;
  Serial.print(millis());Serial.print(',');Serial.print(t,2);Serial.print(',');Serial.print(p,2);Serial.print(',');Serial.println(distanceM,4);
  delay(samplingIntervalMs);
}`
  }
  if (sensors.has('mpu6050') && sensors.has('hc-sr04')) {
    return `#include <Wire.h>
${header}
const byte TRIG_PIN=7,ECHO_PIN=6;
void writeReg(byte r,byte v){Wire.beginTransmission(0x68);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte r){Wire.beginTransmission(0x68);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(0x68,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();writeReg(0x6B,0);pinMode(TRIG_PIN,OUTPUT);pinMode(ECHO_PIN,INPUT);}
void loop(){digitalWrite(TRIG_PIN,LOW);delayMicroseconds(2);digitalWrite(TRIG_PIN,HIGH);delayMicroseconds(10);digitalWrite(TRIG_PIN,LOW);unsigned long us=pulseIn(ECHO_PIN,HIGH,30000);
Serial.print(millis());Serial.print(',');Serial.print(us*0.000343f/2.0f,4);Serial.print(',');Serial.println(read16(0x3B)/16384.0f,5);delay(samplingIntervalMs);}`
  }
  if (sensors.has('mpu6050') && sensors.has('hbe0704')) {
    return `#include <Wire.h>
${header}
void writeReg(byte r,byte v){Wire.beginTransmission(0x68);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte r){Wire.beginTransmission(0x68);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(0x68,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();writeReg(0x6B,0);}
void loop(){float gyroZ=read16(0x47)/131.0f;Serial.print(millis());Serial.print(',');Serial.print(gyroZ,3);Serial.print(',');Serial.println(analogRead(A1));delay(samplingIntervalMs);}`
  }
  if (sensors.has('ina219') && sensors.has('ds18b20')) {
    return `#include <Wire.h>
${header}
${oneWireDriver}
int16_t readIna(byte reg){Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();}
void loop(){startAllTemperatures();delay(750);float busV=(readIna(2)>>3)*0.004f,shuntMv=readIna(1)*0.01f;
Serial.print(millis());Serial.print(',');Serial.print(busV,4);Serial.print(',');Serial.print(shuntMv,4);Serial.print(',');Serial.println(readOnlyTemperatureC(),3);delay(samplingIntervalMs);}`
  }
  if (sensors.has('ina219') && sensors.has('tsl2591')) {
    return `#include <Wire.h>
${header}
int16_t readIna(byte reg){Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
uint16_t lightRaw(){Wire.beginTransmission(0x29);Wire.write(0xB4);Wire.endTransmission(false);Wire.requestFrom(0x29,(byte)2);return Wire.read()|(Wire.read()<<8);}
void setup(){Serial.begin(9600);Wire.begin();Wire.beginTransmission(0x29);Wire.write(0xA0);Wire.write(3);Wire.endTransmission();}
void loop(){Serial.print(millis());Serial.print(',');Serial.print((readIna(2)>>3)*0.004f,4);Serial.print(',');Serial.print(readIna(1)*0.01f,4);Serial.print(',');Serial.println(lightRaw());delay(samplingIntervalMs);}`
  }
  if (sensors.has('ina219') && sensors.has('hbe0704')) {
    return `#include <Wire.h>
${header}
int16_t readIna(byte reg){Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();}
void loop(){Serial.print(millis());Serial.print(',');Serial.print(readIna(1)*0.01f,4);Serial.print(',');Serial.println(analogRead(A1));delay(samplingIntervalMs);}`
  }
  if (sensors.has('ds18b20') && sensors.has('bme280')) {
    return `#include <Wire.h>
${header}
${oneWireDriver}
${bme280Driver}
void setup(){Serial.begin(9600);Wire.begin();bmeBegin();}
void loop(){startAllTemperatures();delay(750);float objectT=readOnlyTemperatureC(),ambientT=bmeTemperatureC();
Serial.print(millis());Serial.print(',');Serial.print(objectT,3);Serial.print(',');Serial.print(ambientT,3);Serial.print(',');Serial.println(bmeHumidity(),2);delay(samplingIntervalMs);}`
  }
  if (sensors.has('hc-sr04')) {
    return `${header}
const byte TRIG_PIN=7,ECHO_PIN=6;
void setup(){Serial.begin(9600);pinMode(TRIG_PIN,OUTPUT);pinMode(ECHO_PIN,INPUT);}
void loop(){
  digitalWrite(TRIG_PIN,LOW);delayMicroseconds(2);digitalWrite(TRIG_PIN,HIGH);
  delayMicroseconds(10);digitalWrite(TRIG_PIN,LOW);
  unsigned long us=pulseIn(ECHO_PIN,HIGH,30000);
  float distanceM=us?us*0.000343f/2.0f:NAN;
  Serial.print(millis());Serial.print(',');Serial.println(distanceM,4);
  delay(samplingIntervalMs);
}`
  }
  if (sensors.has('mpu6050')) {
    return `#include <Wire.h>
${header}
void writeReg(byte a,byte r,byte v){Wire.beginTransmission(a);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte a,byte r){Wire.beginTransmission(a);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(a,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();writeReg(0x68,0x6B,0);}
void loop(){
  float ax=read16(0x68,0x3B)/16384.0f,ay=read16(0x68,0x3D)/16384.0f,az=read16(0x68,0x3F)/16384.0f;
  Serial.print(millis());Serial.print(',');Serial.print(ax,5);Serial.print(',');Serial.print(ay,5);Serial.print(',');Serial.println(az,5);
  delay(samplingIntervalMs);
}`
  }
  if (sensors.has('ina219')) {
    return `#include <Wire.h>
${header}
int16_t readIna(byte reg){Wire.beginTransmission(0x40);Wire.write(reg);Wire.endTransmission(false);Wire.requestFrom(0x40,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();}
void loop(){
  float shuntMv=readIna(0x01)*0.01f,busV=(readIna(0x02)>>3)*0.004f;
  Serial.print(millis());Serial.print(',');Serial.print(busV,4);Serial.print(',');Serial.println(shuntMv,4);
  delay(samplingIntervalMs);
}`
  }
  if (sensors.has('tsl2591')) {
    return `#include <Wire.h>
${header}
uint16_t lightRaw(){Wire.beginTransmission(0x29);Wire.write(0xB4);Wire.endTransmission(false);Wire.requestFrom(0x29,(byte)2);return Wire.read()|(Wire.read()<<8);}
void setup(){Serial.begin(9600);Wire.begin();Wire.beginTransmission(0x29);Wire.write(0xA0);Wire.write(0x03);Wire.endTransmission();}
void loop(){Serial.print(millis());Serial.print(',');Serial.println(lightRaw());delay(samplingIntervalMs);}`
  }
  if (sensors.has('ds18b20')) {
    return definition.sensors.filter((sensor) => sensor === 'ds18b20').length > 1
      ? e6Sketch.replace('const byte sensorCount = 3;', `const byte sensorCount = ${definition.sensors.filter((sensor) => sensor === 'ds18b20').length};`)
      : e2Sketch
  }
  if (sensors.has('bme280')) {
    return `#include <Wire.h>
${header}
${bme280Driver}
void setup(){Serial.begin(9600);Wire.begin();bmeBegin();}
void loop(){float t=bmeTemperatureC(),p=bmePressureHpa();Serial.print(millis());Serial.print(',');Serial.print(t,3);Serial.print(',');Serial.println(p,3);delay(samplingIntervalMs);}`
  }
  return `${header}
void setup(){Serial.begin(9600);}
void loop(){Serial.print(millis());Serial.print(',');Serial.println(analogRead(A0));delay(samplingIntervalMs);}`
}

export function createPhase6Recipe(definition: Phase6RecipeDefinition): Recipe {
  const connections = definition.connections ?? defaultConnections(definition)
  const authoredSketch = definition.sketch ?? genericSketch(definition)
  const declaredPins = new Set(
    [...authoredSketch.matchAll(/\/\/ @pin [^=\r\n]+=([A-Z]\d+)/g)].map((match) => match[1]),
  )
  const boardPins = [...new Set(
    connections
      .flatMap((connection) => [connection.from, connection.to])
      .filter((endpoint) => /^UNO\.(?:A\d+|D\d+)$/.test(endpoint))
      .map((endpoint) => endpoint.slice('UNO.'.length)),
  )]
  const missingPinManifest = boardPins
    .filter((pin) => !declaredPins.has(pin))
    .map((pin) => `// @pin ${pin}=${pin}`)
    .join('\n')
  const sketch = missingPinManifest ? `${missingPinManifest}\n${authoredSketch}` : authoredSketch
  const tunableAnchor = /\/\/ @tunable\s+([A-Za-z_]\w*)/.exec(sketch)?.[1] ?? 'samplingIntervalMs'
  return {
    id: definition.id,
    type: 'project',
    title: definition.title,
    subject: '물리',
    difficulty: definition.difficulty,
    minutes: definition.minutes,
    board: 'uno-r3',
    sensors: [...new Set(definition.sensors)],
    actuators: [],
    coreKeywords: definition.keywords,
    imageUrl: `wiring/${definition.id}.svg`,
    imageWidth: 1100,
    imageHeight: Math.max(800, 138 + Math.floor((connections.length - 1) / 5) * 105),
    wiring: makeWiring(connections),
    sketch,
    baudRate: 9600,
    tunables: [{
      anchor: tunableAnchor,
      name: '측정 간격 (ms)',
      hint: '가장 빠른 변화가 최소 10개 이상의 표본으로 보이도록 조절하세요.',
    }],
    body: `## 탐구 목표

${definition.law}

## 준비물

${definition.apparatus}

## 변인

- 독립 변인: 실험에서 단계적으로 바꾸는 물리량
- 종속 변인: 센서로 기록하는 측정값
- 통제 변인: 장치 위치, 공급 전압, 주변 환경과 표본 간격

## 측정 방법

${definition.method}

## 데이터 처리

${definition.graph}

:::callout warn
전원을 끈 상태에서 배선하고 저전압·저전력 범위를 지키세요. ${definition.safety ?? '움직이는 장치와 가열·회전 부품은 교사의 감독 아래 사용하세요.'}
:::

:::toggle 원리·오차까지 보기
같은 조건을 최소 3회 반복하고 평균뿐 아니라 측정 범위 또는 표준편차를 함께 기록합니다. 센서 영점, 분해능, 축 정렬, 표본 간격과 외부 교란이 결과에 미치는 영향을 구분해 설명하세요.
:::`,
    applicationGuide: '독립 변인의 범위를 넓혀 이론식의 선형화 그래프를 만들고, 기울기와 절편이 나타내는 물리량을 해석하세요.',
    troubleshooting,
    status: 'draft',
    reviewedOnDevice: null,
    commentReviewed: null,
    updatedAt: '2026-07-31T00:00:00.000Z',
  }
}
