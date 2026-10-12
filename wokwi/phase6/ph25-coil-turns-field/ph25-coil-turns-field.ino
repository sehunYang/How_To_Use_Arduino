// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
// @pin HALL_IN=A0
const byte HALL_IN=A0;
const float INA_SHUNT_OHMS=0.1f;
const char* conditionId="N50";
// N000(전류 0), N50, N100, N150 중 실제 조건과 맞추세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=250;
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
  Serial.println("condition_id,time_ms,current_mA,hall_raw");
}
void loop() {
  float currentMa=(readIna(1)*0.01f)/INA_SHUNT_OHMS;
  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(millis());
  Serial.print(',');
  Serial.print(currentMa,3);
  Serial.print(',');
  Serial.println(analogRead(HALL_IN));
  delay(samplingIntervalMs);
}
