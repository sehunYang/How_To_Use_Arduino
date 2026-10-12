// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
const float INA_SHUNT_OHMS = 0.1f;
const char* conditionId = "SERIES_220_1000";
// 병렬 재배선 뒤 PARALLEL_220_1000으로 바꾸세요.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 500;
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
  Serial.println("condition_id,time_ms,bus_V,current_mA,equivalent_ohm");
}
void loop() {
  float busV=(readIna(0x02)>>3)*0.004f,shuntMv=readIna(0x01)*0.01f,currentMa=shuntMv/INA_SHUNT_OHMS;
  float equivalentOhm=currentMa==0?NAN:busV/(currentMa/1000.0f);
  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(millis());
  Serial.print(',');
  Serial.print(busV,4);
  Serial.print(',');
  Serial.print(currentMa,3);
  Serial.print(',');
  Serial.println(equivalentOhm,2);
  delay(samplingIntervalMs);
}
