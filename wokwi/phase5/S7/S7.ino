#include <Wire.h>
#include <Adafruit_INA219.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_INA219 ina219;
// @tunable samplingIntervalMs
int samplingIntervalMs = 500;

void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:S7");
  if (!ina219.begin()) Serial.println("# INA219_ERROR");
  Serial.println("time_ms,voltage_v,current_ma,power_mw");
}

void loop() {
  float busV = ina219.getBusVoltage_V();
  float currentMa = ina219.getCurrent_mA();
  Serial.print(millis());
  Serial.print(',');
  Serial.print(busV, 3);
  Serial.print(',');
  Serial.print(currentMa, 2);
  Serial.print(',');
  Serial.println(busV * currentMa, 2);
  delay(samplingIntervalMs);
}
