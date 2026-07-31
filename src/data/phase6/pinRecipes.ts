import { createPhase6Recipe, type Connection, type Phase6RecipeDefinition } from './shared'

const i2cBase = (token: string, power = 'VCC'): Connection[] => [
  { from: `${token}.${power}`, to: 'UNO.5V', color: 'red', text: `${token} ${power}을 브레드보드 + 전원 레일에 연결하세요.` },
  { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 브레드보드 - 전원 레일에 연결하세요.` },
  { from: `${token}.SDA`, to: 'UNO.A4', color: 'green', text: `${token} SDA를 UNO A4에 연결하세요.` },
  { from: `${token}.SCL`, to: 'UNO.A5', color: 'yellow', text: `${token} SCL을 UNO A5에 연결하세요.` },
]

const tslInterruptSketch = `#include <Wire.h>
// @baud 9600
const byte TSL=0x29, INT_PIN=2;
volatile bool lightEvent=false;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=200;
void writeReg(byte reg,byte value){Wire.beginTransmission(TSL);Wire.write(0xA0|reg);Wire.write(value);Wire.endTransmission();}
uint16_t read16(byte reg){Wire.beginTransmission(TSL);Wire.write(0xA0|reg);Wire.endTransmission(false);Wire.requestFrom(TSL,(byte)2);return Wire.read()|(Wire.read()<<8);}
void onLight(){lightEvent=true;}
void setup(){
  Serial.begin(9600);Wire.begin();pinMode(INT_PIN,INPUT_PULLUP);attachInterrupt(digitalPinToInterrupt(INT_PIN),onLight,FALLING);
  writeReg(0x04,0xE8);writeReg(0x05,0x03); // low=1000
  writeReg(0x06,0x10);writeReg(0x07,0x27); // high=10000
  writeReg(0x00,0x13); // PON|AEN|AIEN
}
void loop(){uint16_t raw=read16(0x14);if(lightEvent){lightEvent=false;Serial.print("INT,");}else Serial.print("sample,");Serial.println(raw);delay(samplingIntervalMs);}`

const dualMpuSketch = `#include <Wire.h>
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void writeReg(byte a,byte r,byte v){Wire.beginTransmission(a);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte a,byte r){Wire.beginTransmission(a);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(a,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void setup(){Serial.begin(9600);Wire.begin();writeReg(0x68,0x6B,0);writeReg(0x69,0x6B,0);}
void loop(){Serial.print(millis());Serial.print(',');Serial.print(read16(0x68,0x3B));Serial.print(',');Serial.println(read16(0x69,0x3B));delay(samplingIntervalMs);}`

const motionInterruptSketch = `#include <Wire.h>
// @baud 9600
const byte MPU=0x68,INT_PIN=2;
volatile bool sampleReady=false;volatile unsigned long interruptUs=0;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=5;
void writeReg(byte r,byte v){Wire.beginTransmission(MPU);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte r){Wire.beginTransmission(MPU);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(MPU,(byte)2);return (int16_t)((Wire.read()<<8)|Wire.read());}
void onData(){interruptUs=micros();sampleReady=true;}
void setup(){Serial.begin(9600);Wire.begin();writeReg(0x6B,0);writeReg(0x38,1);pinMode(INT_PIN,INPUT);attachInterrupt(digitalPinToInterrupt(INT_PIN),onData,RISING);}
void loop(){if(sampleReady){noInterrupts();sampleReady=false;unsigned long t=interruptUs;interrupts();Serial.print(t);Serial.print(',');Serial.println(read16(0x3B)/16384.0f,5);}delay(samplingIntervalMs);}`

const auxBusSketch = `#include <Wire.h>
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=200;
void mpuWrite(byte r,byte v){Wire.beginTransmission(0x68);Wire.write(r);Wire.write(v);Wire.endTransmission();}
uint16_t lightRaw(){Wire.beginTransmission(0x29);Wire.write(0xB4);Wire.endTransmission(false);Wire.requestFrom(0x29,(byte)2);return Wire.read()|(Wire.read()<<8);}
void setup(){Serial.begin(9600);Wire.begin();mpuWrite(0x6B,0);mpuWrite(0x37,0x02);Wire.beginTransmission(0x29);Wire.write(0xA0);Wire.write(3);Wire.endTransmission();}
void loop(){Serial.print(millis());Serial.print(',');Serial.println(lightRaw());delay(samplingIntervalMs);}`

const tcaResetSketch = `#include <Wire.h>
// @baud 9600
const byte RST0=2,RST1=3;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=1000;
bool present(byte address){Wire.beginTransmission(address);return Wire.endTransmission()==0;}
void resetMux(byte pin){digitalWrite(pin,LOW);delayMicroseconds(10);digitalWrite(pin,HIGH);}
void setup(){Serial.begin(9600);Wire.begin();pinMode(RST0,OUTPUT);pinMode(RST1,OUTPUT);digitalWrite(RST0,HIGH);digitalWrite(RST1,HIGH);}
void loop(){resetMux(RST0);resetMux(RST1);Serial.print("0x70=");Serial.print(present(0x70));Serial.print(",0x71=");Serial.println(present(0x71));delay(samplingIntervalMs);}`

const eightPointSketch = `#include <Wire.h>
// @baud 9600
const byte MUX=0x70,LIGHT=0x29;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void selectChannel(byte channel){Wire.beginTransmission(MUX);Wire.write(1<<channel);Wire.endTransmission();}
uint16_t lightRaw(){Wire.beginTransmission(LIGHT);Wire.write(0xB4);Wire.endTransmission(false);Wire.requestFrom(LIGHT,(byte)2);return Wire.read()|(Wire.read()<<8);}
void setup(){Serial.begin(9600);Wire.begin();for(byte ch=0;ch<8;ch++){selectChannel(ch);Wire.beginTransmission(LIGHT);Wire.write(0xA0);Wire.write(3);Wire.endTransmission();}}
void loop(){Serial.print(millis());for(byte ch=0;ch<8;ch++){selectChannel(ch);Serial.print(',');Serial.print(lightRaw());}Serial.println();delay(samplingIntervalMs);}`

const definitions: Phase6RecipeDefinition[] = [
  {
    id: 's11-tsl2591-interrupt',
    title: '조도 임계값 인터럽트 알림',
    difficulty: '중급',
    minutes: 45,
    sensors: ['tsl2591'],
    keywords: ['TSL2591', 'INT', '3VO', '인터럽트', '임계값'],
    law: 'TSL2591의 상·하한 임계값과 INT 출력을 이용해 지속적인 폴링 없이 급격한 광량 변화를 검출합니다.',
    apparatus: 'TSL2591, 10 kΩ 풀업 저항, Arduino UNO, 브레드보드, MF 점퍼선',
    method: 'INT를 D2에 연결하고 3VO를 10 kΩ 풀업 전원으로 사용합니다. 밝기 상·하한을 차례로 바꾸면서 인터럽트 횟수와 원시 조도값을 기록하세요.',
    graph: '시간-조도 그래프 위에 인터럽트 발생 시점을 표시하고 오검출률과 응답 지연을 계산합니다.',
    sketch: tslInterruptSketch,
    connections: [
      ...i2cBase('TSL2591', 'VIN'),
      { from: 'TSL2591.3VO', to: 'RESISTOR_10000.1', color: 'red', text: 'TSL2591 3VO를 10 kΩ 풀업 저항 1번 단자에 연결하세요.' },
      { from: 'RESISTOR_10000.2', to: 'TSL2591.INT', color: 'purple', text: '10 kΩ 저항 2번 단자와 TSL2591 INT를 같은 브레드보드 열에 연결하세요.' },
      { from: 'TSL2591.INT', to: 'UNO.D2', color: 'purple', text: 'TSL2591 INT를 UNO D2 인터럽트 입력에 연결하세요.' },
    ],
  },
  {
    id: 's12-dual-mpu6050-address',
    title: 'MPU6050 두 대의 I²C 주소 분리',
    difficulty: '중급',
    minutes: 50,
    sensors: ['mpu6050'],
    sensorTokens: ['MPU6050_1', 'MPU6050_2'],
    keywords: ['MPU6050', 'AD0', '0x68', '0x69', 'I2C'],
    law: 'AD0의 논리 전위로 같은 버스의 두 MPU6050 주소를 0x68과 0x69로 분리하고 두 물체의 운동을 동시에 비교합니다.',
    apparatus: 'MPU6050 2개, Arduino UNO, 브레드보드, MF 점퍼선',
    method: '첫 센서 AD0는 GND, 둘째 센서 AD0는 5V에 연결합니다. I²C 스캔 후 두 센서를 서로 다른 방향으로 기울여 값이 독립적으로 변하는지 확인하세요.',
    graph: '두 센서의 시간-가속도 곡선을 한 좌표계에 그리고 교차상관으로 시간차를 비교합니다.',
    sketch: dualMpuSketch,
    connections: [
      ...i2cBase('MPU6050_1'),
      ...i2cBase('MPU6050_2'),
      { from: 'MPU6050_1.AD0', to: 'UNO.GND', color: 'black', text: '첫 MPU6050 AD0를 - 레일에 연결해 주소를 0x68로 설정하세요.' },
      { from: 'MPU6050_2.AD0', to: 'UNO.5V', color: 'red', text: '둘째 MPU6050 AD0를 + 레일에 연결해 주소를 0x69로 설정하세요.' },
    ],
  },
  {
    id: 'p9-motion-interrupt',
    title: '충돌 순간과 충격 지속시간 측정',
    difficulty: '중급',
    minutes: 55,
    sensors: ['mpu6050'],
    keywords: ['MPU6050', 'INT', '충돌', '충격량', '지속시간'],
    law: 'MPU6050 INT 핀으로 데이터 준비 시점을 고정해 충돌 구간의 가속도-시간 적분과 충격 지속시간을 구합니다.',
    apparatus: 'MPU6050, 저속 카트 또는 진자, 완충재, Arduino UNO, 브레드보드, MF 점퍼선',
    method: 'INT를 D2에 연결하고 낮은 속도에서 충돌시킵니다. 인터럽트 타임스탬프와 3축 가속도를 기록해 충돌 전후 기준선을 제거하세요.',
    graph: '가속도-시간 그래프의 충돌 구간 면적을 계산하고 완충재에 따른 최대가속도와 지속시간을 비교합니다.',
    sketch: motionInterruptSketch,
    connections: [
      ...i2cBase('MPU6050'),
      { from: 'MPU6050.INT', to: 'UNO.D2', color: 'purple', text: 'MPU6050 INT를 UNO D2 인터럽트 입력에 연결하세요.' },
    ],
  },
  {
    id: 's13-mpu-aux-tsl2591',
    title: 'MPU6050 보조 I²C로 조도센서 읽기',
    difficulty: '고급',
    minutes: 70,
    sensors: ['mpu6050', 'tsl2591'],
    keywords: ['MPU6050', 'XDA', 'XCL', '보조 I2C', 'TSL2591'],
    law: 'MPU6050의 XDA/XCL 보조 I²C 버스에 TSL2591을 연결해 주 버스와 보조 버스의 계층 구조를 이해합니다.',
    apparatus: 'MPU6050, TSL2591, Arduino UNO, 브레드보드, MF 점퍼선',
    method: 'MPU6050은 UNO의 주 I²C에 연결하고 TSL2591 SDA/SCL은 각각 XDA/XCL에 연결합니다. bypass 모드와 master 모드에서 접근 경로를 비교하세요.',
    graph: '자세 변화와 조도값을 같은 시간축에 나타내고 보조 버스 갱신 주기에 따른 지연을 계산합니다.',
    sketch: auxBusSketch,
    connections: [
      ...i2cBase('MPU6050'),
      { from: 'TSL2591.VIN', to: 'UNO.5V', color: 'red', text: 'TSL2591 VIN을 브레드보드 + 전원 레일에 연결하세요.' },
      { from: 'TSL2591.GND', to: 'UNO.GND', color: 'black', text: 'TSL2591 GND를 브레드보드 - 전원 레일에 연결하세요.' },
      { from: 'TSL2591.SDA', to: 'MPU6050.XDA', color: 'green', text: 'TSL2591 SDA를 MPU6050 XDA에 연결하세요.' },
      { from: 'TSL2591.SCL', to: 'MPU6050.XCL', color: 'yellow', text: 'TSL2591 SCL을 MPU6050 XCL에 연결하세요.' },
    ],
  },
  {
    id: 's14-tca-address-reset',
    title: 'TCA9548A 주소 분리와 RESET 복구',
    difficulty: '고급',
    minutes: 65,
    sensors: ['tca9548a'],
    sensorTokens: ['TCA9548A_1', 'TCA9548A_2'],
    keywords: ['TCA9548A', 'A0', 'A1', 'A2', 'RST', '버스 복구'],
    law: '주소 선택 핀으로 두 멀티플렉서를 0x70/0x71로 분리하고 active-low RST로 선택 상태와 걸린 버스를 복구합니다.',
    apparatus: 'TCA9548A 2개, 10 kΩ 풀업 저항 2개, Arduino UNO, 브레드보드, MF 점퍼선',
    method: '첫 모듈 A0~A2는 GND, 둘째 모듈은 A0만 5V에 연결합니다. RST를 각각 D2/D3에서 LOW 펄스로 구동해 채널 선택이 초기화되는지 확인하세요.',
    graph: '리셋 명령 시점과 복구 완료 시점의 차이를 기록해 버스 복구 시간을 비교합니다.',
    sketch: tcaResetSketch,
    connections: [
      ...i2cBase('TCA9548A_1', 'VIN'),
      ...i2cBase('TCA9548A_2', 'VIN'),
      { from: 'TCA9548A_1.A0', to: 'UNO.GND', color: 'black', text: '첫 TCA9548A A0를 - 레일에 연결하세요.' },
      { from: 'TCA9548A_1.A1', to: 'UNO.GND', color: 'black', text: '첫 TCA9548A A1을 - 레일에 연결하세요.' },
      { from: 'TCA9548A_1.A2', to: 'UNO.GND', color: 'black', text: '첫 TCA9548A A2를 - 레일에 연결하세요.' },
      { from: 'TCA9548A_2.A0', to: 'UNO.5V', color: 'red', text: '둘째 TCA9548A A0를 + 레일에 연결하세요.' },
      { from: 'TCA9548A_2.A1', to: 'UNO.GND', color: 'black', text: '둘째 TCA9548A A1을 - 레일에 연결하세요.' },
      { from: 'TCA9548A_2.A2', to: 'UNO.GND', color: 'black', text: '둘째 TCA9548A A2를 - 레일에 연결하세요.' },
      { from: 'TCA9548A_1.RST', to: 'UNO.D2', color: 'purple', text: '첫 TCA9548A RST를 UNO D2에 연결하세요.' },
      { from: 'TCA9548A_2.RST', to: 'UNO.D3', color: 'purple', text: '둘째 TCA9548A RST를 UNO D3에 연결하세요.' },
    ],
  },
  {
    id: 'p10-eight-point-light-field',
    title: '8지점 광량 분포와 차광 패턴 분석',
    difficulty: '고급',
    minutes: 90,
    sensors: ['tca9548a', 'tsl2591'],
    sensorTokens: ['TCA9548A', ...Array.from({ length: 8 }, (_, index) => `TSL2591_${index + 1}`)],
    keywords: ['TCA9548A', '8채널', 'TSL2591', '광량 분포', '히트맵'],
    law: 'TCA9548A의 SD0/SC0부터 SD7/SC7까지 모든 채널을 사용해 동일 주소 조도센서 8개의 공간 분포를 순차 측정합니다.',
    apparatus: 'TCA9548A 1개, TSL2591 8개, Arduino UNO, 대형 브레드보드, MF 점퍼선',
    method: '각 채널에 TSL2591 한 개씩 연결하고 센서를 일정 간격 격자로 배치합니다. 채널을 순환 선택해 같은 조명 조건에서 8개 값을 기록하세요.',
    graph: '센서 좌표에 측정값을 배치해 2×4 히트맵을 만들고 거리·차광판 위치에 따른 공간 기울기를 구합니다.',
    sketch: eightPointSketch,
    connections: [
      ...i2cBase('TCA9548A', 'VIN'),
      ...Array.from({ length: 8 }, (_, channel): Connection[] => {
        const token = `TSL2591_${channel + 1}`
        return [
          { from: `${token}.VIN`, to: 'UNO.5V', color: 'red', text: `${token} VIN을 + 전원 레일의 떨어진 홀에 연결하세요.` },
          { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 - 전원 레일의 떨어진 홀에 연결하세요.` },
          { from: `${token}.SDA`, to: `TCA9548A.SD${channel}`, color: 'green', text: `${token} SDA를 TCA9548A SD${channel}에 연결하세요.` },
          { from: `${token}.SCL`, to: `TCA9548A.SC${channel}`, color: 'yellow', text: `${token} SCL을 TCA9548A SC${channel}에 연결하세요.` },
        ]
      }).flat(),
    ],
  },
]

export const phase6PinRecipes = definitions.map(createPhase6Recipe)
