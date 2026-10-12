#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
const byte MUX=0x70;
Adafruit_TSL2591 tsl(2591);
// @tunable channelSettleMs
const unsigned int channelSettleMs = 25;
void selectChannel(byte channel) {
  Wire.beginTransmission(MUX);
  Wire.write(1<<channel);
  Wire.endTransmission();
  delay(channelSettleMs);
}
float readLight() {
  uint32_t lum=tsl.getFullLuminosity();
  return tsl.calculateLux(lum & 0xffff, lum >> 16);
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  for(byte channel=0;channel<3;channel++) {
    selectChannel(channel);
    if(!tsl.begin())Serial.println("# TSL2591_ERROR");
    // 창가처럼 밝은 자리는 기본 증폭(25배)의 측정 범위를 넘으므로 낮춰 둡니다.
    tsl.setGain(TSL2591_GAIN_LOW);
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  }
  Serial.println("time_ms,position,lux");
}
void loop() {
  for(byte channel=0;channel<3;channel++) {
    selectChannel(channel);
    Serial.print(millis());
    Serial.print(',');
    Serial.print(channel);
    Serial.print(',');
    Serial.println(readLight());
  }
  delay(500);
}
