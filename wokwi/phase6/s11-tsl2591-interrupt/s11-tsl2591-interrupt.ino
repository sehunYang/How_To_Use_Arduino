// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
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
void writeReg(byte reg,byte value) {
  Wire.beginTransmission(TSL);
  Wire.write(0xA0|reg);
  Wire.write(value);
  Wire.endTransmission();
}
uint16_t read16(byte reg) {
  Wire.beginTransmission(TSL);
  Wire.write(0xA0|reg);
  Wire.endTransmission(false);
  Wire.requestFrom(TSL,(byte)2);
  byte low=Wire.read();
  byte high=Wire.read();
  // 두 줄로 나눠 읽는 순서를 확정합니다.
  return (uint16_t)low|((uint16_t)high<<8);
}
// INT는 한 번 걸리면 스스로 풀리지 않습니다. Special Function 0xE7로 지워야
// 다음 하강 에지가 생기므로, 이 호출이 없으면 인터럽트는 딱 한 번만 발생합니다.
void clearInterrupt() {
  Wire.beginTransmission(TSL);
  Wire.write(0xE7);
  Wire.endTransmission();
}
void onLight() {
  eventMs=millis();
  lightEvent=true;
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(INT_PIN,INPUT);
  // INT는 오픈 드레인이고 외부 10 kΩ이 3VO로 끌어올립니다.
  attachInterrupt(digitalPinToInterrupt(INT_PIN),onLight,FALLING);
  writeReg(0x04,lowThreshold&0xFF);
  writeReg(0x05,lowThreshold>>8);
  writeReg(0x06,highThreshold&0xFF);
  writeReg(0x07,highThreshold>>8);
  writeReg(0x0C,0x03);
  // APERS: 연속 3회 벗어날 때만 알림
  writeReg(0x00,0x13);
  // PON|AEN|AIEN
  clearInterrupt();
  Serial.println("event,time_ms,interrupt_count,light_raw");
}
void loop() {
  uint16_t raw=read16(0x14);
  if(lightEvent) {
    noInterrupts();
    lightEvent=false;
    unsigned long at=eventMs;
    interrupts();
    interruptCount++;
    clearInterrupt();
    Serial.print("INT,");
    Serial.print(at);
  }
  else {
    Serial.print("sample,");
    Serial.print(millis());
  }
  Serial.print(',');
  Serial.print(interruptCount);
  Serial.print(',');
  Serial.println(raw);
  delay(samplingIntervalMs);
}
