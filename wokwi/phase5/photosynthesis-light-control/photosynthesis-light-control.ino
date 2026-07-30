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
  Serial.println("PHASE5_READY:photosynthesis-light-control");
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  if (!light.begin()) Serial.println("TSL2591_ERROR");
  light.setGain(TSL2591_GAIN_LOW);
  light.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,lamp");
}
void loop() {
  uint32_t raw = light.getFullLuminosity();
  float lux = light.calculateLux(raw & 0xffff, raw >> 16);
  static bool lamp = false;
  if (lux < targetLux * 0.9) lamp = true;
  if (lux > targetLux * 1.1) lamp = false;
  digitalWrite(RELAY_PIN, lamp ? HIGH : LOW);
  Serial.print(millis()); Serial.print(',');
  Serial.print(lux, 2); Serial.print(',');
  Serial.println(lamp);
  delay(1000);
}
