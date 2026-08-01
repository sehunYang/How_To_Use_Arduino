import { createPhase6Recipe, type Connection, type Phase6RecipeDefinition } from './shared'

const i2cBase = (token: string, power = 'VCC'): Connection[] => [
  { from: `${token}.${power}`, to: 'UNO.5V', color: 'red', text: `${token} ${power}을 브레드보드 + 전원 레일에 연결하세요.` },
  { from: `${token}.GND`, to: 'UNO.GND', color: 'black', text: `${token} GND를 브레드보드 - 전원 레일에 연결하세요.` },
  { from: `${token}.SDA`, to: 'UNO.A4', color: 'green', text: `${token} SDA를 UNO A4에 연결하세요.` },
  { from: `${token}.SCL`, to: 'UNO.A5', color: 'yellow', text: `${token} SCL을 UNO A5에 연결하세요.` },
]

const tslInterruptSketch = `#include <Wire.h>
// @baud 9600
// @pin INT=D2
const byte TSL=0x29, INT_PIN=2;
volatile bool lightEvent=false;
volatile unsigned long eventMs=0;
unsigned long interruptCount=0;
// 알림 기준값. 기준 조합 실험은 이 두 값을 바꿔 가며 반복하세요.
const uint16_t lowThreshold=1000, highThreshold=10000;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=50;
void writeReg(byte reg,byte value){Wire.beginTransmission(TSL);Wire.write(0xA0|reg);Wire.write(value);Wire.endTransmission();}
uint16_t read16(byte reg){
  Wire.beginTransmission(TSL);Wire.write(0xA0|reg);Wire.endTransmission(false);Wire.requestFrom(TSL,(byte)2);
  byte low=Wire.read();byte high=Wire.read(); // 두 줄로 나눠 읽는 순서를 확정합니다.
  return (uint16_t)low|((uint16_t)high<<8);
}
// INT는 한 번 걸리면 스스로 풀리지 않습니다. Special Function 0xE7로 지워야
// 다음 하강 에지가 생기므로, 이 호출이 없으면 인터럽트는 딱 한 번만 발생합니다.
void clearInterrupt(){Wire.beginTransmission(TSL);Wire.write(0xE7);Wire.endTransmission();}
void onLight(){eventMs=millis();lightEvent=true;}
void setup(){
  Serial.begin(9600);Wire.begin();
  pinMode(INT_PIN,INPUT); // INT는 오픈 드레인이고 외부 10 kΩ이 3VO로 끌어올립니다.
  attachInterrupt(digitalPinToInterrupt(INT_PIN),onLight,FALLING);
  writeReg(0x04,lowThreshold&0xFF);writeReg(0x05,lowThreshold>>8);
  writeReg(0x06,highThreshold&0xFF);writeReg(0x07,highThreshold>>8);
  writeReg(0x0C,0x03); // APERS: 연속 3회 벗어날 때만 알림
  writeReg(0x00,0x13); // PON|AEN|AIEN
  clearInterrupt();
  Serial.println("event,time_ms,interrupt_count,light_raw");
}
void loop(){
  uint16_t raw=read16(0x14);
  if(lightEvent){
    noInterrupts();lightEvent=false;unsigned long at=eventMs;interrupts();
    interruptCount++;clearInterrupt();
    Serial.print("INT,");Serial.print(at);
  }else{
    Serial.print("sample,");Serial.print(millis());
  }
  Serial.print(',');Serial.print(interruptCount);Serial.print(',');Serial.println(raw);
  delay(samplingIntervalMs);
}`

const dualMpuSketch = `#include <Wire.h>
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void writeReg(byte a,byte r,byte v){Wire.beginTransmission(a);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte a,byte r){
  Wire.beginTransmission(a);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(a,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup(){Serial.begin(9600);Wire.begin();writeReg(0x68,0x6B,0);writeReg(0x69,0x6B,0);Serial.println("time_ms,mpu_0x68_accel_x_raw,mpu_0x69_accel_x_raw");}
void loop(){Serial.print(millis());Serial.print(',');Serial.print(read16(0x68,0x3B));Serial.print(',');Serial.println(read16(0x69,0x3B));delay(samplingIntervalMs);}`

// 충돌은 보통 10~50 ms 안에 끝납니다. 9600 baud로는 초당 약 24행밖에 보낼 수
// 없어 충돌 구간에 표본이 1개도 남지 않으므로 115200 baud로 올리고, 표본 속도를
// MPU6050의 DATA_RDY 분주로 확정합니다. 시리얼 모니터도 115200으로 맞추세요.
const motionInterruptSketch = `#include <Wire.h>
// @baud 115200
// @pin INT=D2
const byte MPU=0x68,INT_PIN=2;
volatile bool sampleReady=false;volatile unsigned long interruptUs=0;
// @tunable sampleRateDivider
byte sampleRateDivider=4; // 표본 속도 = 1000 Hz / (1 + 값). 4면 200 Hz입니다.
void writeReg(byte r,byte v){Wire.beginTransmission(MPU);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t read16(byte r){
  Wire.beginTransmission(MPU);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(MPU,(byte)2);
  byte high=Wire.read();byte low=Wire.read();
  return (int16_t)(((uint16_t)high<<8)|low);
}
void onData(){interruptUs=micros();sampleReady=true;}
void setup(){
  Serial.begin(115200);Wire.begin();Wire.setClock(400000);
  writeReg(0x6B,0);
  writeReg(0x1A,0x01); // 대역폭 184 Hz — 필터를 켜 내부 출력이 1 kHz가 되면서도 짧은 충돌 봉우리를 뭉개지 않습니다.
  writeReg(0x1C,0x18); // ±16 g — 충돌 봉우리는 ±2 g 기본 범위를 훌쩍 넘습니다.
  writeReg(0x19,sampleRateDivider);
  writeReg(0x37,0x10); // 값을 읽기만 해도 INT가 풀리도록 설정합니다.
  writeReg(0x38,1); // 표본이 준비될 때마다 INT로 알립니다.
  pinMode(INT_PIN,INPUT);
  attachInterrupt(digitalPinToInterrupt(INT_PIN),onData,RISING);
  Serial.println("time_us,acceleration_x_g,acceleration_y_g,acceleration_z_g");
}
void loop(){
  if(!sampleReady) return;
  noInterrupts();sampleReady=false;unsigned long t=interruptUs;interrupts();
  float ax=read16(0x3B)/2048.0f,ay=read16(0x3D)/2048.0f,az=read16(0x3F)/2048.0f;
  Serial.print(t);Serial.print(',');Serial.print(ax,4);Serial.print(',');
  Serial.print(ay,4);Serial.print(',');Serial.println(az,4);
}`

const auxBusSketch = `#include <Wire.h>
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=200;
void mpuWrite(byte r,byte v){Wire.beginTransmission(0x68);Wire.write(r);Wire.write(v);Wire.endTransmission();}
int16_t mpuRead16(byte r){
  Wire.beginTransmission(0x68);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(0x68,(byte)2);
  byte high=Wire.read();byte low=Wire.read(); // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
uint16_t lightRaw(){
  mpuWrite(0x25,0xA9);mpuWrite(0x26,0xB4);mpuWrite(0x27,0x82);delay(2);
  Wire.beginTransmission(0x68);Wire.write(0x49);Wire.endTransmission(false);Wire.requestFrom(0x68,(byte)2);
  byte low=Wire.read();byte high=Wire.read();
  return (uint16_t)low|((uint16_t)high<<8);
}
void setup(){Serial.begin(9600);Wire.begin();mpuWrite(0x6B,0);mpuWrite(0x37,0x02);Wire.beginTransmission(0x29);Wire.write(0xA0);Wire.write(3);Wire.endTransmission();mpuWrite(0x37,0);mpuWrite(0x6A,0x20);mpuWrite(0x24,0x0D);Serial.println("time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g,light_raw");}
void loop(){
  // 같은 행에 자세(가속도)와 조도를 함께 남겨 두 값을 같은 시간축에 놓습니다.
  float ax=mpuRead16(0x3B)/16384.0f,ay=mpuRead16(0x3D)/16384.0f,az=mpuRead16(0x3F)/16384.0f;
  Serial.print(millis());Serial.print(',');Serial.print(ax,4);Serial.print(',');
  Serial.print(ay,4);Serial.print(',');Serial.print(az,4);Serial.print(',');
  Serial.println(lightRaw());delay(samplingIntervalMs);
}`

const tcaResetSketch = `#include <Wire.h>
// @baud 9600
// @pin RST0=D2
// @pin RST1=D3
const byte RST0=2,RST1=3;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=1000;
bool present(byte address){Wire.beginTransmission(address);return Wire.endTransmission()==0;}
void selectChannel(byte address,byte channel){Wire.beginTransmission(address);Wire.write(1<<channel);Wire.endTransmission();}
byte readChannels(byte address){Wire.requestFrom(address,(byte)1);return Wire.available()?Wire.read():0xFF;}
// 채널을 하나 열어 둔 뒤 RST에 LOW 펄스를 주고, 멀티플렉서가 다시 응답하면서
// 채널 선택이 0으로 지워질 때까지 걸린 시간을 마이크로초로 잽니다.
unsigned long recoverMicros(byte address,byte pin){
  selectChannel(address,0);
  unsigned long start=micros();
  digitalWrite(pin,LOW);delayMicroseconds(10);digitalWrite(pin,HIGH);
  while(micros()-start<20000UL){if(present(address)&&readChannels(address)==0)break;}
  return micros()-start;
}
void setup(){
  Serial.begin(9600);Wire.begin();
  pinMode(RST0,OUTPUT);pinMode(RST1,OUTPUT);
  digitalWrite(RST0,HIGH);digitalWrite(RST1,HIGH);
  Serial.println("time_ms,mux_0x70_recovery_us,mux_0x70_channels,mux_0x71_recovery_us,mux_0x71_channels");
}
void loop(){
  unsigned long recovery0=recoverMicros(0x70,RST0);byte channels0=readChannels(0x70);
  unsigned long recovery1=recoverMicros(0x71,RST1);byte channels1=readChannels(0x71);
  Serial.print(millis());Serial.print(',');Serial.print(recovery0);Serial.print(',');
  Serial.print(channels0);Serial.print(',');Serial.print(recovery1);Serial.print(',');
  Serial.println(channels1);
  delay(samplingIntervalMs);
}`

const eightPointSketch = `#include <Wire.h>
// @baud 9600
const byte MUX=0x70,LIGHT=0x29;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void selectChannel(byte channel){Wire.beginTransmission(MUX);Wire.write(1<<channel);Wire.endTransmission();}
uint16_t lightRaw(){
  Wire.beginTransmission(LIGHT);Wire.write(0xB4);Wire.endTransmission(false);Wire.requestFrom(LIGHT,(byte)2);
  byte low=Wire.read();byte high=Wire.read(); // TSL2591은 하위 바이트가 먼저 옵니다.
  return (uint16_t)low|((uint16_t)high<<8);
}
void setup(){Serial.begin(9600);Wire.begin();for(byte ch=0;ch<8;ch++){selectChannel(ch);Wire.beginTransmission(LIGHT);Wire.write(0xA0);Wire.write(3);Wire.endTransmission();}Serial.println("time_ms,light_ch0_raw,light_ch1_raw,light_ch2_raw,light_ch3_raw,light_ch4_raw,light_ch5_raw,light_ch6_raw,light_ch7_raw");}
void loop(){Serial.print(millis());for(byte ch=0;ch<8;ch++){selectChannel(ch);Serial.print(',');Serial.print(lightRaw());}Serial.println();delay(samplingIntervalMs);}`

const definitions: Phase6RecipeDefinition[] = [
  {
    id: 's11-tsl2591-interrupt',
    title: '조도 임계값 인터럽트 알림',
    difficulty: '중급',
    minutes: 45,
    sensors: ['tsl2591'],
    keywords: ['TSL2591', 'INT', '3VO', '인터럽트', '임계값'],
    law: 'TSL2591의 상·하한 기준값과 INT 출력을 이용해 값을 계속 반복해서 확인하지 않고도 급격한 광량 변화를 알아냅니다.',
    apparatus: 'TSL2591, 신호선을 기본 HIGH 상태로 유지하는 10 kΩ 저항(풀업 저항), Arduino UNO, 브레드보드, 수-암(MF) 점퍼선',
    method: 'INT를 D2에 연결하고 3VO를 10 kΩ 풀업 전원으로 사용합니다. 밝기 상·하한을 차례로 바꾸면서 인터럽트 횟수와 원시 조도값을 기록하세요.',
    graph: '시간-조도 그래프 위에 인터럽트 발생 시점을 표시하고 오검출률과 응답 지연을 계산합니다.',
    sketch: tslInterruptSketch,
    connections: [
      ...i2cBase('TSL2591', 'VIN'),
      { from: 'TSL2591.3VO', to: 'RESISTOR_10000.1', color: 'red', text: 'TSL2591 3VO를 신호선을 기본 HIGH 상태로 유지하는 10 kΩ 저항 1번 단자에 연결하세요.' },
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
    law: 'AD0의 HIGH/LOW 전압 상태로 같은 통신선에 연결된 두 MPU6050 주소를 0x68과 0x69로 나누고 두 물체의 운동을 동시에 비교합니다.',
    apparatus: 'MPU6050 2개, Arduino UNO, 브레드보드, 수-암(MF) 점퍼선',
    method: '첫 센서 AD0는 GND, 둘째 센서 AD0는 UNO의 3.3V 핀에 연결합니다. MPU6050 칩의 전원 전압은 3.3V이고 AD0는 모듈에서 전압 변환 없이 칩에 바로 연결되므로 5V를 넣으면 센서가 손상될 수 있습니다. I²C 스캔 후 두 센서를 서로 다른 방향으로 기울여 값이 독립적으로 변하는지 확인하세요.',
    graph: '두 센서의 시간-가속도 곡선을 한 좌표계에 그리고, 한쪽만 기울일 때와 같은 판에 붙여 함께 흔들 때의 곡선 모양을 비교합니다.',
    sketch: dualMpuSketch,
    connections: [
      ...i2cBase('MPU6050_1'),
      ...i2cBase('MPU6050_2'),
      { from: 'MPU6050_1.AD0', to: 'UNO.GND', color: 'black', text: '첫 MPU6050 AD0를 - 레일에 연결해 주소를 0x68로 설정하세요.' },
      { from: 'MPU6050_2.AD0', to: 'UNO.3.3V', color: 'orange', text: '둘째 MPU6050 AD0를 UNO 3.3V 핀에 연결해 주소를 0x69로 설정하세요. AD0는 3.3V 로직 입력이므로 5V 레일에 연결하면 안 됩니다.' },
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
    apparatus: 'MPU6050, 저속 카트 또는 진자, 완충재, Arduino UNO, 브레드보드, 수-암(MF) 점퍼선 (시리얼 모니터 115200 baud)',
    method: 'INT를 D2에 연결하고 낮은 속도에서 충돌시킵니다. 시리얼 모니터 속도를 115200으로 맞추세요. 알림이 발생한 시각과 3축 가속도를 기록한 뒤 모든 값에서 충돌 전 평균값을 빼세요.',
    graph: '가속도-시간 그래프의 충돌 구간 면적을 계산하고 완충재에 따른 최대가속도와 지속시간을 비교합니다. time_us는 마이크로초 단위입니다.',
    tunable: {
      name: '표본 속도 분주값',
      hint: '표본 속도 = 1000 Hz ÷ (1 + 값)입니다. 충돌 구간에 표본이 20개 이상 들어가도록 정하되, 115200 baud에서는 약 280 Hz가 상한입니다.',
    },
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
    apparatus: 'MPU6050, TSL2591(3.3V로 공급), Arduino UNO, 브레드보드, 수-암(MF) 점퍼선',
    method: 'MPU6050은 UNO의 주 I²C에 연결하고 TSL2591 SDA/SCL은 각각 XDA/XCL에 연결합니다. 보조 통신선은 3.3V 로직이므로 TSL2591 전원도 반드시 3.3V에서 공급합니다. 설정 단계에서 잠시 직접 연결 모드(bypass)로 센서를 초기화한 뒤, MPU6050이 보조 통신선을 대신 읽어 주는 제어 모드(master)로 자세와 조도를 함께 기록합니다.',
    graph: '자세(가속도) 변화와 조도값을 같은 시간 기준으로 겹쳐 그려, 주 통신선 하나로 두 센서의 값을 함께 얻을 수 있음을 확인합니다.',
    sketch: auxBusSketch,
    connections: [
      ...i2cBase('MPU6050'),
      { from: 'TSL2591.VIN', to: 'UNO.3.3V', color: 'orange', text: 'TSL2591 VIN을 UNO 3.3V 핀에 연결하세요. 이 모듈의 SDA/SCL 풀업은 VIN 전압을 따르므로, 5V로 공급하면 3.3V 로직인 MPU6050 XDA/XCL에 과전압이 걸립니다.' },
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
    law: '주소 선택 핀으로 여러 센서 연결 중 하나를 고르는 장치(멀티플렉서) 두 개를 0x70/0x71로 나누고, LOW일 때 작동하는 RST로 선택 상태와 멈춘 통신선을 복구합니다.',
    apparatus: 'TCA9548A 2개, Arduino UNO, 브레드보드, 수-암(MF) 점퍼선',
    method: '첫 모듈 A0~A2는 GND, 둘째 모듈은 A0만 5V에 연결합니다. 스케치는 채널 0을 연 뒤 RST에 LOW 펄스를 주고, 모듈이 다시 응답하며 채널 선택 레지스터가 0으로 지워질 때까지의 시간을 마이크로초로 잽니다. 이 값에는 응답을 확인하는 I²C 통신 자체의 시간(약 100 µs)이 포함되므로 그 아래로는 내려가지 않습니다.',
    graph: '두 모듈의 mux_0x70_recovery_us·mux_0x71_recovery_us 분포를 비교하고, mux_0x70_channels·mux_0x71_channels 열이 리셋 뒤 0으로 돌아오는지 확인해 복구 성공률을 계산합니다.',
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
    keywords: ['TCA9548A', '8채널', 'TSL2591', '광량 분포', '색상 분포도'],
    law: 'TCA9548A의 SD0/SC0부터 SD7/SC7까지 모든 채널을 사용해 동일 주소 조도센서 8개의 공간 분포를 순차 측정합니다.',
    apparatus: 'TCA9548A 1개, TSL2591 8개, Arduino UNO, 대형 브레드보드, 수-암(MF) 점퍼선',
    method: '각 채널에 TSL2591 한 개씩 연결하고 센서를 일정 간격 격자로 배치합니다. 채널을 순환 선택해 같은 조명 조건에서 8개 값을 기록하세요.',
    graph: '센서 좌표에 측정값을 배치해 값의 크기를 색으로 나타낸 2×4 분포도를 만들고 거리·차광판 위치에 따른 공간 기울기를 구합니다.',
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
