#include <Wire.h>
#include <Adafruit_BME280.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin ONE_WIRE=D4
// @baud 9600

Adafruit_BME280 bme;
OneWire oneWire(4);
DallasTemperature probes(&oneWire);
// 표본 간격입니다. 습구는 천천히 안정되므로 촘촘히 잴 필요가 없습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 2000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  probes.begin();
  Serial.println("time_ms,dry_c,wet_c,humidity_pct");
}

void loop() {
  probes.requestTemperatures();
  // 버스에 달린 순서는 프로브의 고유 번호가 정합니다. 꽂은 순서가 아닙니다.
  // 0번이 건구가 맞는지 손으로 한쪽을 쥐어 확인한 뒤 기록을 시작하세요.
  Serial.print(millis());
  Serial.print(',');
  Serial.print(probes.getTempCByIndex(0), 2);
  Serial.print(',');
  Serial.print(probes.getTempCByIndex(1), 2);
  Serial.print(',');
  Serial.println(bme.readHumidity(), 2);
  delay(samplingIntervalMs);
}
