#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_TSL2591 tsl(2591);
// @tunable channelDelayMs
int channelDelayMs = 120;

void selectChannel(byte channel) {
  Wire.beginTransmission(0x70);
  Wire.write(1 << channel);
  Wire.endTransmission();
}

void readChannel(byte channel) {
  selectChannel(channel);
  delay(channelDelayMs);
  uint32_t lum = tsl.getFullLuminosity();
  Serial.print(millis());
  Serial.print(',');
  Serial.print(channel);
  Serial.print(',');
  Serial.println(lum & 0xffff);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  // 채널마다 begin()을 불러야 두 센서의 신호 증폭 정도와 측정 시간이 같아집니다.
  // 채널 0에서만 부르면 채널 1 센서는 전원투입 기본 설정으로 남아 두 위치의
  // 값을 그대로 비교할 수 없습니다.
  for (byte channel = 0; channel < 2; ++channel) {
    selectChannel(channel);
    if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
    tsl.setGain(TSL2591_GAIN_MED);
    tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  }
  Serial.println("time_ms,channel,light_raw");
}

void loop() {
  readChannel(0);
  readChannel(1);
  delay(500);
}
