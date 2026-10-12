// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
#include <Adafruit_TSL2591.h>
#include <Servo.h>

// @pin SERVO=D9
// @baud 9600

Adafruit_TSL2591 tsl(2591);
Servo curtain;
// 이 밝기를 넘으면 커튼을 엽니다. 닫는 기준은 이 값의 절반으로 둡니다.
// @tunable openLux
float openLux = 300.0;

bool isOpen = false;

void setup() {
  Serial.begin(9600);
  if (!tsl.begin()) Serial.println("# TSL2591_ERROR");
  tsl.setGain(TSL2591_GAIN_MED);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  curtain.attach(9);
  curtain.write(0);
  Serial.println("time_ms,lux,commanded_deg");
}

void loop() {
  uint32_t lum = tsl.getFullLuminosity();
  float lux = tsl.calculateLux(lum & 0xffff, lum >> 16);

  // 여는 밝기와 닫는 밝기를 두 배 차이로 벌려 둡니다. 구름이 지나갈 때마다
  // 커튼이 여닫히면 서보와 기구물이 먼저 상합니다.
  if (!isOpen && lux > openLux) isOpen = true;
  if (isOpen && lux < openLux / 2) isOpen = false;

  int angle = isOpen ? 120 : 0;
  curtain.write(angle);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(lux, 2);
  Serial.print(',');
  Serial.println(angle);
  delay(1000);
}
