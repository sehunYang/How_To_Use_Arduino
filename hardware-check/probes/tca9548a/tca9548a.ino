// 실물 점검: TCA9548A I2C 멀티플렉서 (SDA=A4, SCL=A5)
// 멀티플렉서 주소를 찾고, 채널마다 연결된 장치 주소를 한 줄씩 기록합니다.
#include <Wire.h>

byte mux = 0;

bool present(byte address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("# PROBE tca9548a v1");
  for (byte candidate = 0x70; candidate <= 0x77 && mux == 0; candidate++) {
    if (present(candidate)) mux = candidate;
  }
  Serial.print("# mux=0x");
  Serial.println(mux, HEX);
  Serial.println("channel,address");
  if (mux == 0) return;
  for (byte channel = 0; channel < 8; channel++) {
    Wire.beginTransmission(mux);
    Wire.write(1 << channel);
    Wire.endTransmission();
    for (byte address = 0x08; address < 0x78; address++) {
      if (address == mux) continue;
      if (present(address)) {
        Serial.print(channel);
        Serial.print(",0x");
        Serial.println(address, HEX);
      }
    }
  }
}

void loop() {}
