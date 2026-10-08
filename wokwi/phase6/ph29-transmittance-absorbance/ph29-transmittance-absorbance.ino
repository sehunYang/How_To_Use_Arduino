// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// 투과율과 흡광도
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;

uint16_t lightRaw() {
  Wire.beginTransmission(0x29);
  Wire.write(0xB4);
  Wire.endTransmission(false);
  Wire.requestFrom(0x29,(byte)2);
  byte low=Wire.read();
  byte high=Wire.read();
  // TSL2591은 하위 바이트가 먼저 옵니다.
  return (uint16_t)low|((uint16_t)high<<8);
}
// 증폭·측정시간 설정: 0x00=1배·100ms(기본), 0x10=25배, 0x20=428배.
// 어두운 쪽이 0에 붙으면 값을 올리고, light_raw가 65535 근처에 붙으면 낮추세요.
const byte LIGHT_CONFIG=0x00;
void setup() {
  Serial.begin(9600);
  Wire.begin();
  Wire.beginTransmission(0x29);
  Wire.write(0xA0);
  Wire.write(0x03);
  Wire.endTransmission();
  Wire.beginTransmission(0x29);
  Wire.write(0xA1);
  Wire.write(LIGHT_CONFIG);
  Wire.endTransmission();
  Serial.println("time_ms,light_raw");
}
void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.println(lightRaw());
  delay(samplingIntervalMs);
}
