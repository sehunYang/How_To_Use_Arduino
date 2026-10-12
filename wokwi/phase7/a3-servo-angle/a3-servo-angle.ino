#include <Servo.h>

// @pin SERVO=D9
// @baud 9600

Servo horn;
// 한 각도에서 멈춰 있는 시간입니다. 기구물이 무거우면 늘리세요.
// @tunable holdMs
int holdMs = 1000;

void setup() {
  Serial.begin(9600);
  horn.attach(9);
  Serial.println("time_ms,commanded_deg");
}

void loop() {
  // 서보는 "몇 도로 가라"는 명령만 받습니다. 실제로 그 각도에 닿았는지는
  // 알려 주지 않으므로, 기구물이 걸리면 명령과 실제 각도가 달라집니다.
  for (int angle = 0; angle <= 180; angle += 30) {
    horn.write(angle);
    Serial.print(millis());
    Serial.print(',');
    Serial.println(angle);
    delay(holdMs);
  }
}
