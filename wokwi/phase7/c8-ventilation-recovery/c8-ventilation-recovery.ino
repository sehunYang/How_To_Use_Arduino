// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <Adafruit_BME280.h>

// @pin RELAY=D7
// @baud 9600

Adafruit_BME280 bme;
const byte RELAY_PIN = 7;
// 팬을 켜 두는 시간입니다. 방의 크기에 맞춰 늘리거나 줄이세요.
// @tunable fanOnSeconds
int fanOnSeconds = 120;

void report(int fanState) {
  Serial.print(millis());
  Serial.print(',');
  Serial.print(bme.readTemperature(), 2);
  Serial.print(',');
  Serial.print(bme.readHumidity(), 2);
  Serial.print(',');
  Serial.println(fanState);
}

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("time_ms,temperature_c,humidity_pct,fan");
}

void loop() {
  // 켜기 전 2분, 켠 동안, 끈 뒤 5분을 한 줄기로 남깁니다. 회복 시간은
  // 끈 시각을 알아야 잴 수 있으므로 팬 상태를 매 행에 함께 적습니다.
  for (int i = 0; i < 24; i++) {
    report(0);
    delay(5000);
  }
  digitalWrite(RELAY_PIN, HIGH);
  for (int i = 0; i < fanOnSeconds / 5; i++) {
    report(1);
    delay(5000);
  }
  digitalWrite(RELAY_PIN, LOW);
  for (int i = 0; i < 60; i++) {
    report(0);
    delay(5000);
  }
}
