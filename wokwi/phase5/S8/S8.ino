#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_TSL2591 tsl(2591);
// @tunable samplingIntervalMs
int samplingIntervalMs = 500;

void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:S8");
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  // 신호 증폭 정도와 측정 시간은 아래 두 줄을 바꿔 조절합니다.
  // 밝은 곳: GAIN_LOW, 어두운 곳: GAIN_HIGH. lux가 -1이면 범위를 넘은 것입니다.
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux");
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ir = lum >> 16;
  uint16_t full = lum & 0xffff;
  Serial.print(millis());
  Serial.print(',');
  Serial.println(tsl.calculateLux(full, ir), 2);
  delay(samplingIntervalMs);
}
