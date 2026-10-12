// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// 용수철 진동의 주기와 질량
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;

int16_t mpuRead16(byte address,byte reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(address,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  return (int16_t)(((uint16_t)high<<8)|low);
}
void mpuWrite(byte address,byte reg,byte value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  mpuWrite(0x68,0x6B,0);
  Serial.println("time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g");
}
void loop() {
  float ax=mpuRead16(0x68,0x3B)/16384.0f,ay=mpuRead16(0x68,0x3D)/16384.0f,az=mpuRead16(0x68,0x3F)/16384.0f;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(ax,5);
  Serial.print(',');
  Serial.print(ay,5);
  Serial.print(',');
  Serial.println(az,5);
  delay(samplingIntervalMs);
}
