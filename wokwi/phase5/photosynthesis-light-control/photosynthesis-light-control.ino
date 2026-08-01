#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin RELAY=D7
// @baud 9600
Adafruit_TSL2591 light(2591);
const byte RELAY_PIN = 7;
// @tunable targetLux
float targetLux = 500.0;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:photosynthesis-light-control");
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  if (!light.begin()) Serial.println("# TSL2591_ERROR");
  light.setGain(TSL2591_GAIN_LOW);
  light.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,lamp");
}
void loop() {
  uint32_t raw = light.getFullLuminosity();
  float lux = light.calculateLux(raw & 0xffff, raw >> 16);
  static bool lamp = false;
  static unsigned long lastSwitch = 0;
  // 조명 자신이 센서 밝기를 크게 바꾸므로, 기준 간격만으로는 릴레이가 초 단위로
  // 반복 동작해 접점이 빨리 상합니다. 최소 유지 시간을 함께 둡니다.
  if (millis() - lastSwitch >= 10000) {
    if (lux < targetLux * 0.9 && !lamp) {
      lamp = true;
      lastSwitch = millis();
    }
    else if (lux > targetLux * 1.1 && lamp) {
      lamp = false;
      lastSwitch = millis();
    }
  }
  digitalWrite(RELAY_PIN, lamp ? HIGH : LOW);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(lux, 2);
  Serial.print(',');
  Serial.println(lamp);
  delay(1000);
}
