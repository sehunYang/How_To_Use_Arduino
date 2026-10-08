// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS=0.1f;
const char* conditionId="R1K";
// R10K, R4K7, R2K2, R1K, R470, R220, R100 중 실제 연결한 저항과 맞추세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=500;
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
void setup() {
  Serial.begin(9600);
  Wire.begin();
  Wire.beginTransmission(0x29);
  Wire.write(0xA0);
  Wire.write(0x03);
  Wire.endTransmission();
  Serial.println("condition_id,time_ms,panel_V,current_mA,power_mW,light_raw");
}
void loop() {
  float panelV=(readIna(2)>>3)*0.004f,currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;
  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(millis());
  Serial.print(',');
  Serial.print(panelV,4);
  Serial.print(',');
  Serial.print(currentMa,3);
  Serial.print(',');
  Serial.print(panelV*currentMa,3);
  Serial.print(',');
  Serial.println(lightRaw());
  delay(samplingIntervalMs);
}
