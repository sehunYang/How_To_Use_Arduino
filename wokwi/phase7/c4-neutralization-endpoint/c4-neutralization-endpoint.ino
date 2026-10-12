#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 한 방울의 온도 변화를 놓치지 않을 만큼 짧아야 합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  probe.begin();
  probe.setResolution(12);
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  // 시간에 따른 온도만 남깁니다. 몇 mL를 넣었는지는 사람이 노트에 적고
  // 나중에 시각으로 맞춥니다. 스케치가 부피를 알 방법은 없습니다.
  Serial.print(millis());
  Serial.print(',');
  Serial.println(probe.getTempCByIndex(0), 3);
  delay(samplingIntervalMs);
}
