// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=200;
void mpuWrite(byte r,byte v) {
  Wire.beginTransmission(0x68);
  Wire.write(r);
  Wire.write(v);
  Wire.endTransmission();
}
int16_t mpuRead16(byte r) {
  Wire.beginTransmission(0x68);
  Wire.write(r);
  Wire.endTransmission(false);
  Wire.requestFrom(0x68,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}
uint16_t lightRaw() {
  mpuWrite(0x25,0xA9);
  mpuWrite(0x26,0xB4);
  mpuWrite(0x27,0x82);
  delay(2);
  Wire.beginTransmission(0x68);
  Wire.write(0x49);
  Wire.endTransmission(false);
  Wire.requestFrom(0x68,(byte)2);
  byte low=Wire.read();
  byte high=Wire.read();
  return (uint16_t)low|((uint16_t)high<<8);
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:s13-mpu-aux-tsl2591");
  Wire.begin();
  mpuWrite(0x6B,0);
  mpuWrite(0x37,0x02);
  Wire.beginTransmission(0x29);
  Wire.write(0xA0);
  Wire.write(3);
  Wire.endTransmission();
  mpuWrite(0x37,0);
  mpuWrite(0x6A,0x20);
  mpuWrite(0x24,0x0D);
  Serial.println("time_ms,acceleration_x_g,acceleration_y_g,acceleration_z_g,light_raw");
}
void loop() {
  // 같은 행에 자세(가속도)와 조도를 함께 남겨 두 값을 같은 시간축에 놓습니다.
  float ax=mpuRead16(0x3B)/16384.0f,ay=mpuRead16(0x3D)/16384.0f,az=mpuRead16(0x3F)/16384.0f;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(ax,4);
  Serial.print(',');
  Serial.print(ay,4);
  Serial.print(',');
  Serial.print(az,4);
  Serial.print(',');
  Serial.println(lightRaw());
  delay(samplingIntervalMs);
}
