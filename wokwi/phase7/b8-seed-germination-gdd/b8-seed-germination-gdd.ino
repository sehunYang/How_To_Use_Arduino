#include <OneWire.h>
#include <DallasTemperature.h>

// @pin ONE_WIRE=D4
// @baud 9600

OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 며칠을 기록하므로 1분에 한 번이면 넉넉합니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 60000;

void setup() {
  Serial.begin(9600);
  probe.begin();
  Serial.println("time_ms,temperature_c");
}

void loop() {
  probe.requestTemperatures();
  // 적산온도는 여기서 더하지 않습니다. 기준 온도를 몇 도로 잡을지는
  // 씨앗마다 다르고, 원시 기록만 있으면 나중에 몇 번이든 다시 더할 수 있습니다.
  Serial.print(millis());
  Serial.print(',');
  Serial.println(probe.getTempCByIndex(0), 2);
  delay(samplingIntervalMs);
}
