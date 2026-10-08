// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void writeReg(byte a,byte r,byte v) {
  Wire.beginTransmission(a);
  Wire.write(r);
  Wire.write(v);
  Wire.endTransmission();
}
int16_t read16(byte a,byte r) {
  Wire.beginTransmission(a);
  Wire.write(r);
  Wire.endTransmission(false);
  Wire.requestFrom(a,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  writeReg(0x68,0x6B,0);
  writeReg(0x69,0x6B,0);
  Serial.println("time_ms,mpu_0x68_accel_x_raw,mpu_0x69_accel_x_raw");
}
void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.print(read16(0x68,0x3B));
  Serial.print(',');
  Serial.println(read16(0x69,0x3B));
  delay(samplingIntervalMs);
}
