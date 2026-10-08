// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
int16_t mpuRead16(byte reg) {
  Wire.beginTransmission(0x68);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(0x68,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
void mpuWrite(byte reg,byte value) {
  Wire.beginTransmission(0x68);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=100;
void setup() {
  Serial.begin(9600);
  Wire.begin();
  mpuWrite(0x6B,0);
  Serial.println("time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g,gyro_z_dps");
}
void loop() {
  float ax=mpuRead16(0x3B)/16384.0f,ay=mpuRead16(0x3D)/16384.0f,az=mpuRead16(0x3F)/16384.0f;
  float gz=mpuRead16(0x47)/131.0f;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(ax,5);
  Serial.print(',');
  Serial.print(ay,5);
  Serial.print(',');
  Serial.print(az,5);
  Serial.print(',');
  Serial.println(gz,3);
  delay(samplingIntervalMs);
}
