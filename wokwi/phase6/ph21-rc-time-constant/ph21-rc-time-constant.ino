// @pin A4=A4
// @pin A5=A5
// @pin A0=A0
#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS=0.1f;
const byte CAPACITOR_VOLTAGE_PIN=A0;
const char* conditionId="CHARGE";
// 방전 회로로 옮긴 뒤 DISCHARGE로 바꾸세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=50;
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
void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("condition_id,time_ms,capacitor_V,current_mA");
}
void loop() {
  float capacitorV=analogRead(CAPACITOR_VOLTAGE_PIN)*(5.0f/1023.0f),currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;
  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(millis());
  Serial.print(',');
  Serial.print(capacitorV,4);
  Serial.print(',');
  Serial.println(currentMa,4);
  delay(samplingIntervalMs);
}
