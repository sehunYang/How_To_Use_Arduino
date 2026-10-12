#include <Servo.h>

// @pin TRIG=D7
// @pin ECHO=D6
// @pin SERVO=D9
// @pin BUZZER=D8
// @baud 9600

const byte TRIG_PIN = 7, ECHO_PIN = 6, BUZZER_PIN = 8;
Servo bar;
// 차단기를 여는 거리입니다. 닫는 거리는 이보다 5 cm 넉넉히 잡습니다.
// @tunable openCm
int openCm = 20;

bool isOpen = false;

long readCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  return us == 0 ? -1 : (long)(us / 58);
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  bar.attach(9);
  bar.write(0);
  Serial.println("time_ms,distance_cm,door_state,buzzer_on");
}

void loop() {
  long cm = readCm();
  // 여는 기준과 닫는 기준을 벌려 둡니다. 하나로 두면 차가 그 거리 언저리에
  // 서 있을 때 차단기가 계속 여닫히며 떨립니다.
  if (!isOpen && cm > 0 && cm < openCm) isOpen = true;
  if (isOpen && (cm < 0 || cm > openCm + 5)) isOpen = false;

  bar.write(isOpen ? 90 : 0);
  int buzzerOn = (cm > 0 && cm < openCm / 2) ? 1 : 0;
  if (buzzerOn) tone(BUZZER_PIN, 1200);
  else noTone(BUZZER_PIN);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(cm);
  Serial.print(',');
  Serial.print(isOpen ? 1 : 0);
  Serial.print(',');
  Serial.println(buzzerOn);
  delay(100);
}
