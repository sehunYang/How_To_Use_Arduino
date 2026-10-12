// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
const byte MUX=0x70,LIGHT=0x29;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void selectChannel(byte channel) {
  Wire.beginTransmission(MUX);
  Wire.write(1<<channel);
  Wire.endTransmission();
}
uint16_t lightRaw() {
  Wire.beginTransmission(LIGHT);
  Wire.write(0xB4);
  Wire.endTransmission(false);
  Wire.requestFrom(LIGHT,(byte)2);
  byte low=Wire.read();
  byte high=Wire.read();
  // TSL2591은 하위 바이트가 먼저 옵니다.
  return (uint16_t)low|((uint16_t)high<<8);
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  for(byte ch=0;ch<8;ch++) {
    selectChannel(ch);
    Wire.beginTransmission(LIGHT);
    Wire.write(0xA0);
    Wire.write(3);
    Wire.endTransmission();
  }
  Serial.println("time_ms,light_ch0_raw,light_ch1_raw,light_ch2_raw,light_ch3_raw,light_ch4_raw,light_ch5_raw,light_ch6_raw,light_ch7_raw");
}
void loop() {
  Serial.print(millis());
  for(byte ch=0;ch<8;ch++) {
    selectChannel(ch);
    Serial.print(',');
    Serial.print(lightRaw());
  }
  Serial.println();
  delay(samplingIntervalMs);
}
