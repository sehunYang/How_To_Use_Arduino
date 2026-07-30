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
  Serial.println("PHASE5_READY:S8");
  if (!tsl.begin()) Serial.println("TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ir = lum >> 16;
  uint16_t full = lum & 0xffff;
  Serial.print("lux="); Serial.println(tsl.calculateLux(full, ir), 2);
  delay(samplingIntervalMs);
}
