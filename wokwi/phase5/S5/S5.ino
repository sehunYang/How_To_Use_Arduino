#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature sensors(&oneWire);
// @tunable conversionIntervalMs
int conversionIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:S5");
  sensors.begin();
}

void loop() {
  sensors.requestTemperatures();
  float celsius = sensors.getTempCByIndex(0);
  if (celsius == DEVICE_DISCONNECTED_C) Serial.println("sensor-error");
  else {
    Serial.print("water_c=");
    Serial.println(celsius, 2);
  }
  delay(conversionIntervalMs);
}
