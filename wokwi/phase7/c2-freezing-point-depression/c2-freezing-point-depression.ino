#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 어는 구간의 평평한 부분을 놓치지 않을 만큼 촘촘해야 합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 2000;

void setup() {
  Serial.begin(9600);
  probe.begin();
  // 0.5 °C 단위로는 어는점 내림 1 °C를 셋으로도 못 나눕니다. 12비트로 올려
  // 0.0625 °C 단위로 읽습니다.
  probe.setResolution(12);
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  Serial.print(millis());
  Serial.print(',');
  Serial.println(probe.getTempCByIndex(0), 3);
  delay(samplingIntervalMs);
}
