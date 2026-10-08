// @pin A4=A4
// @pin A5=A5
#include <Wire.h>

// @pin LED=D9
// @baud 9600

const byte LED_PIN = 9;
// 한 밝기 단계를 유지하는 시간입니다. 조도센서가 안정될 만큼 길게 두세요.
// @tunable stepHoldMs
int stepHoldMs = 2000;

uint16_t lightRaw() {
  Wire.beginTransmission(0x29);
  Wire.write(0xB4);
  Wire.endTransmission(false);
  Wire.requestFrom(0x29, (byte)2);
  // 한 식 안에서 두 번 읽으면 순서가 정해지지 않아 바이트가 뒤바뀝니다.
  byte low = Wire.read();
  byte high = Wire.read();
  return (uint16_t)low | ((uint16_t)high << 8);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(LED_PIN, OUTPUT);
  // 조도센서를 켜고 100 ms 동안 빛을 모으도록 설정합니다.
  Wire.beginTransmission(0x29);
  Wire.write(0xA0);
  Wire.write(0x03);
  Wire.endTransmission();
  Serial.println("time_ms,pwm_value,light_raw");
}

void loop() {
  // analogWrite는 0~255 사이의 값으로 켜져 있는 시간의 비율을 바꿉니다.
  // 사람 눈에는 밝기가 변한 것처럼 보이지만 실제로는 빠르게 껐다 켜는 것입니다.
  for (int pwm = 0; pwm <= 255; pwm += 51) {
    analogWrite(LED_PIN, pwm);
    delay(stepHoldMs);
    Serial.print(millis());
    Serial.print(',');
    Serial.print(pwm);
    Serial.print(',');
    Serial.println(lightRaw());
  }
}
