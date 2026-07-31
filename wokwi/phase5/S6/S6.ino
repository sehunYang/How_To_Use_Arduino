#include <Wire.h>
#include <Adafruit_BME280.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_BME280 bme;
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:S6");
  if (!bme.begin(0x76)) Serial.println("BME280_ERROR");
}

void loop() {
  Serial.print("temperature_c=");
  Serial.print(bme.readTemperature(), 2);
  Serial.print(", humidity_pct=");
  Serial.print(bme.readHumidity(), 2);
  Serial.print(", pressure_hpa=");
  Serial.println(bme.readPressure() / 100.0, 2);
  delay(samplingIntervalMs);
}
