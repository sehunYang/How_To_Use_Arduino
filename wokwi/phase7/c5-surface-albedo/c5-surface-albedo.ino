// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <Adafruit_TSL2591.h>

// @pin LED=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
const byte LED_PIN = 9;
// 한 밝기 단계를 유지하는 시간입니다. 센서가 안정될 만큼 길게 두세요.
// @tunable stepHoldMs
int stepHoldMs = 3000;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,pwm_value,reflected_raw");
}

void loop() {
  // 밝기를 세 단계로 바꾸며 잽니다. 반사율이 재료의 성질이라면 세 단계 모두에서
  // 같은 비율이 나와야 합니다. 한 단계만 재면 그것을 확인할 수 없습니다.
  const int levels[] = {
    85, 170, 255
  }
  ;
  for (byte i = 0; i < 3; i++) {
    analogWrite(LED_PIN, levels[i]);
    delay(stepHoldMs);
    uint32_t lum = tsl.getFullLuminosity();
    Serial.print(millis());
    Serial.print(',');
    Serial.print(levels[i]);
    Serial.print(',');
    Serial.println((uint16_t)(lum & 0xffff));
  }
}
