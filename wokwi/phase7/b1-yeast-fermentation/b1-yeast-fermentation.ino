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
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 발효는 분 단위로 진행하므로 촘촘히 잴 필요가 없습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 2000;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  probe.begin();
  Serial.println("time_ms,water_c,pressure_hpa");
}

void loop() {
  probe.requestTemperatures();
  Serial.print(millis());
  Serial.print(',');
  Serial.print(probe.getTempCByIndex(0), 2);
  Serial.print(',');
  // 기압계는 용기 안 공기의 압력을 잽니다. 효모가 내놓은 이산화탄소가
  // 쌓이면 이 값이 오릅니다.
  Serial.println(bme.readPressure() / 100.0, 2);
  delay(samplingIntervalMs);
}
