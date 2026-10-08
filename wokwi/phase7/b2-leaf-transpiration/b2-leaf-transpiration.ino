#include <Wire.h>
#include <Adafruit_BME280.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_BME280 bme;
// 표본 간격입니다. 습도는 천천히 오르므로 길게 잡아도 모양을 놓치지 않습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 5000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  Serial.println("time_ms,temperature_c,humidity_pct");
}

void loop() {
  // 온도를 함께 남깁니다. 같은 수증기량이라도 온도가 오르면 상대습도는
  // 내려가므로, 온도 없이 습도만 보면 증산이 멈춘 것처럼 읽힙니다.
  Serial.print(millis());
  Serial.print(',');
  Serial.print(bme.readTemperature(), 2);
  Serial.print(',');
  Serial.println(bme.readHumidity(), 2);
  delay(samplingIntervalMs);
}
