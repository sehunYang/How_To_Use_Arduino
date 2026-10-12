// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 115200
const byte MPU_ADDRESSES[2]= {
  0x68,0x69
}
;
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs=5;
// 200 Hz: 수십 ms 충돌에 표본 10개 이상을 남깁니다.
void mpuWrite(byte a,byte r,byte v) {
  Wire.beginTransmission(a);
  Wire.write(r);
  Wire.write(v);
  Wire.endTransmission();
}
int16_t mpuRead16(byte a,byte r) {
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
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000);
  for(byte i=0;i<2;i++) {
    mpuWrite(MPU_ADDRESSES[i],0x6B,0);
    mpuWrite(MPU_ADDRESSES[i],0x1A,0x01);
    // 대역폭 184 Hz: 짧은 충돌 봉우리를 뭉개지 않습니다.
    mpuWrite(MPU_ADDRESSES[i],0x1C,0x18);
    // ±16 g: 충돌 봉우리는 ±2 g 기본 범위를 넘습니다.
  }
  Serial.println("time_ms,mpu0_ax_g,mpu1_ax_g");
}
void loop() {
  static unsigned long last=0;
  if(millis()-last<samplingIntervalMs)return;
  last=millis();
  Serial.print(last);
  for(byte i=0;i<2;i++) {
    Serial.print(',');
    Serial.print(mpuRead16(MPU_ADDRESSES[i],0x3B)/2048.0f,4);
  }
  Serial.println();
}
