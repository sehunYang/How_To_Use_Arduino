// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
// @pin ONEWIRE=D2
const byte ONEWIRE=2;
const float INA_SHUNT_OHMS=0.1f;
const char* conditionId="HEATING";
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=1000;
int16_t readIna(byte reg) {
  Wire.beginTransmission(0x40);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void oneWireReset() {
  pinMode(ONEWIRE,OUTPUT);
  digitalWrite(ONEWIRE,LOW);
  delayMicroseconds(480);
  pinMode(ONEWIRE,INPUT_PULLUP);
  delayMicroseconds(480);
}
// 1-Wire 비트는 마이크로초 단위입니다. 시리얼 인터럽트가 끼어들면 펄스가 늘어나 값이 틀어지므로 잠시 막습니다.
void writeOneWire(byte value) {
  for(byte i=0;i<8;i++) {
    noInterrupts();
    pinMode(ONEWIRE,OUTPUT);
    digitalWrite(ONEWIRE,LOW);
    delayMicroseconds((value>>i)&1?6:60);
    pinMode(ONEWIRE,INPUT_PULLUP);
    interrupts();
    delayMicroseconds((value>>i)&1?64:10);
  }
}
byte readOneWire() {
  byte value=0;
  for(byte i=0;i<8;i++) {
    noInterrupts();
    pinMode(ONEWIRE,OUTPUT);
    digitalWrite(ONEWIRE,LOW);
    delayMicroseconds(3);
    pinMode(ONEWIRE,INPUT_PULLUP);
    delayMicroseconds(10);
    bool bit=digitalRead(ONEWIRE);
    interrupts();
    if(bit)value|=(1<<i);
    delayMicroseconds(53);
  }
  return value;
}
float readTemperatureC() {
  oneWireReset();
  writeOneWire(0xCC);
  writeOneWire(0x44);
  delay(750);
  oneWireReset();
  writeOneWire(0xCC);
  writeOneWire(0xBE);
  byte lsb=readOneWire();
  byte msb=readOneWire();
  int16_t raw=(int16_t)(((uint16_t)msb<<8)|lsb);
  return raw/16.0f;
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("condition_id,time_ms,bus_V,current_mA,power_W,temperature_C");
}
void loop() {
  float busV=(readIna(2)>>3)*0.004f,currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS,tempC=readTemperatureC();
  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(millis());
  Serial.print(',');
  Serial.print(busV,4);
  Serial.print(',');
  Serial.print(currentMa,3);
  Serial.print(',');
  Serial.print(busV*currentMa/1000.0f,4);
  Serial.print(',');
  Serial.println(tempC,3);
  delay(samplingIntervalMs);
}
