// 실물 점검: BME280 (SDA=A4, SCL=A5)
// 주소(0x76/0x77)와 칩 ID를 확인합니다. 0x58이면 습도가 없는 BMP280입니다.
#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
byte address = 0;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("# PROBE bme280 v1");
  for (byte candidate = 0x76; candidate <= 0x77; candidate++) {
    Wire.beginTransmission(candidate);
    if (Wire.endTransmission() == 0 && address == 0) address = candidate;
  }
  Serial.print("# address=0x");
  Serial.println(address, HEX);
  if (address == 0) return;
  Wire.beginTransmission(address);
  Wire.write(0xD0);
  Wire.endTransmission(false);
  Wire.requestFrom(address, (byte)1);
  Serial.print("# chip_id=0x");
  Serial.println(Wire.read(), HEX);
  if (!bme.begin(address)) {
    Serial.println("# begin=failed");
    address = 0;
    return;
  }
  Serial.println("time_ms,temperature_c,pressure_hpa,humidity_pct");
}

void loop() {
  if (address == 0) return;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(bme.readTemperature(), 2);
  Serial.print(',');
  Serial.print(bme.readPressure() / 100.0, 2);
  Serial.print(',');
  Serial.println(bme.readHumidity(), 2);
  delay(1000);
}
