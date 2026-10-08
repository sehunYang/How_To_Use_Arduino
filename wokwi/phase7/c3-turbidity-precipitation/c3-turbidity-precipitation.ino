// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin LED=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
const byte LED_PIN = 9;
uint16_t baselineRaw = 1;
// 표본 간격입니다. 침전은 초 단위로 진행하므로 짧게 잡습니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 500;

uint16_t readFull() {
  uint32_t lum = tsl.getFullLuminosity();
  return (uint16_t)(lum & 0xffff);
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  analogWrite(LED_PIN, 255);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  delay(1000);
  // 맑은 물을 통과한 빛을 100 %의 기준으로 삼습니다. 이 값을 잡기 전에
  // 시약을 넣으면 그 뒤의 모든 투과율이 틀립니다.
  baselineRaw = readFull();
  if (baselineRaw == 0) baselineRaw = 1;
  Serial.println("time_ms,light_raw,transmittance_pct");
}

void loop() {
  uint16_t raw = readFull();
  Serial.print(millis());
  Serial.print(',');
  Serial.print(raw);
  Serial.print(',');
  Serial.println(100.0 * raw / baselineRaw, 2);
  delay(samplingIntervalMs);
}
