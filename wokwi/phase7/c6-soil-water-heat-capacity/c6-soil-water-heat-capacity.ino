#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probes(&oneWire);
// 표본 간격입니다. 가열과 냉각 모두 분 단위로 진행합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 5000;

void setup() {
  Serial.begin(9600);
  probes.begin();
  probes.setResolution(12);
  Serial.println("time_ms,soil_c,water_c");
}

void loop() {
  probes.requestTemperatures();
  Serial.print(millis());
  Serial.print(',');
  Serial.print(probes.getTempCByIndex(0), 2);
  Serial.print(',');
  Serial.println(probes.getTempCByIndex(1), 2);
  delay(samplingIntervalMs);
}
