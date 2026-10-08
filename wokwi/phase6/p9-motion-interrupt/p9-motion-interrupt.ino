// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 115200
// @pin INT=D2
const byte MPU=0x68,INT_PIN=2;
volatile bool sampleReady=false;
volatile unsigned long interruptUs=0;
// @tunable sampleRateDivider
byte sampleRateDivider=4;
// 표본 속도 = 1000 Hz / (1 + 값). 4면 200 Hz입니다.
void writeReg(byte r,byte v) {
  Wire.beginTransmission(MPU);
  Wire.write(r);
  Wire.write(v);
  Wire.endTransmission();
}
int16_t read16(byte r) {
  Wire.beginTransmission(MPU);
  Wire.write(r);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  return (int16_t)(((uint16_t)high<<8)|low);
}
void onData() {
  interruptUs=micros();
  sampleReady=true;
}
void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000);
  writeReg(0x6B,0);
  writeReg(0x1A,0x01);
  // 대역폭 184 Hz: 필터를 켜 내부 출력이 1 kHz가 되면서도 짧은 충돌 봉우리를 뭉개지 않습니다.
  writeReg(0x1C,0x18);
  // ±16 g: 충돌 봉우리는 ±2 g 기본 범위를 훌쩍 넘습니다.
  writeReg(0x19,sampleRateDivider);
  writeReg(0x37,0x10);
  // 값을 읽기만 해도 INT가 풀리도록 설정합니다.
  writeReg(0x38,1);
  // 표본이 준비될 때마다 INT로 알립니다.
  pinMode(INT_PIN,INPUT);
  attachInterrupt(digitalPinToInterrupt(INT_PIN),onData,RISING);
  Serial.println("time_us,acceleration_x_g,acceleration_y_g,acceleration_z_g");
}
void loop() {
  if(!sampleReady) return;
  noInterrupts();
  sampleReady=false;
  unsigned long t=interruptUs;
  interrupts();
  float ax=read16(0x3B)/2048.0f,ay=read16(0x3D)/2048.0f,az=read16(0x3F)/2048.0f;
  Serial.print(t);
  Serial.print(',');
  Serial.print(ax,4);
  Serial.print(',');
  Serial.print(ay,4);
  Serial.print(',');
  Serial.println(az,4);
}
