// 실물 점검: MPU6050 (SDA=A4, SCL=A5)
// 주소와 WHO_AM_I로 칩을 확인하고, 50 Hz로 가속도(g)와 각속도(°/s)를 기록합니다.
#include <Wire.h>

byte address = 0;

byte read8(byte reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(address, (byte)1);
  return Wire.read();
}

int16_t read16(byte reg) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(address, (byte)2);
  byte high = Wire.read();
  byte low = Wire.read();
  return (int16_t)((high << 8) | low);
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial.println("# PROBE mpu6050 v1");
  for (byte candidate = 0x68; candidate <= 0x69; candidate++) {
    Wire.beginTransmission(candidate);
    if (Wire.endTransmission() == 0 && address == 0) address = candidate;
  }
  Serial.print("# address=0x");
  Serial.println(address, HEX);
  if (address == 0) return;
  // 정품 MPU6050은 0x68을 돌려줍니다. 0x70(MPU6500), 0x71(MPU9250), 0x98은 호환 칩입니다.
  Serial.print("# who_am_i=0x");
  Serial.println(read8(0x75), HEX);
  Wire.beginTransmission(address);
  Wire.write(0x6B);
  Wire.write(0);
  Wire.endTransmission();
  Serial.println("time_ms,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps");
}

void loop() {
  if (address == 0) return;
  static unsigned long last = 0;
  if (millis() - last < 20) return;
  last = millis();
  Serial.print(last);
  for (byte reg = 0x3B; reg <= 0x3F; reg += 2) {
    Serial.print(',');
    Serial.print(read16(reg) / 16384.0, 4);
  }
  for (byte reg = 0x43; reg <= 0x47; reg += 2) {
    Serial.print(',');
    Serial.print(read16(reg) / 131.0, 3);
  }
  Serial.println();
}
