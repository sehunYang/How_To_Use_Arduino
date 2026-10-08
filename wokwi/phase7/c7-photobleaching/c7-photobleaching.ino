// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin LED=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
const byte LED_PIN = 9;
uint16_t baselineRaw = 1;
// 표본 간격입니다. 색이 빠지는 데 한 시간이 걸리므로 길게 잡습니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 10000;

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
  // 색소를 넣기 전 맑은 용매를 통과한 값입니다. 흡광도를 계산하는 분모가
  // 되므로 매 시각 함께 내보내, 나중에 어떤 기준을 썼는지 알 수 있게 합니다.
  baselineRaw = readFull();
  if (baselineRaw == 0) baselineRaw = 1;
  Serial.println("time_ms,light_raw,baseline_raw");
}

void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.print(readFull());
  Serial.print(',');
  Serial.println(baselineRaw);
  delay(samplingIntervalMs);
}
