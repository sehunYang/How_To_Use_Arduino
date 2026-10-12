#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_TSL2591.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

Adafruit_BME280 bme;
Adafruit_TSL2591 tsl(2591);
// 표본 간격입니다. 한 조건을 10분 이상 기록해야 기울기가 보입니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 5000;

void setup() {
  Serial.begin(9600);
  if (!bme.begin(0x76)) Serial.println("# BME280_ERROR");
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,lux,pressure_hpa,temperature_c");
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ir = lum >> 16, full = lum & 0xffff;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(tsl.calculateLux(full, ir), 2);
  Serial.print(',');
  Serial.print(bme.readPressure() / 100.0, 2);
  Serial.print(',');
  // 압력은 온도만 올라도 오릅니다. 기체가 늘어난 것과 구분하려면
  // 용기 안 온도를 반드시 함께 남겨야 합니다.
  Serial.println(bme.readTemperature(), 2);
  delay(samplingIntervalMs);
}
