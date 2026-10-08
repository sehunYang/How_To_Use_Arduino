// @pin LED=D9
// @pin TRIG=D7
// @pin ECHO=D6
// @baud 9600

const byte LED_PIN = 9, TRIG_PIN = 7, ECHO_PIN = 6;
// 손이 들어왔다고 판정할 거리입니다. 센서와 손을 놓는 자리에 맞춰 정하세요.
// @tunable triggerCm
int triggerCm = 15;

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
  pinMode(LED_PIN, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  // 꽂지 않은 아날로그 핀의 흔들리는 값을 씨앗으로 삼아 매번 다른 순서를 만듭니다.
  randomSeed(analogRead(A3));
  Serial.println("time_ms,reaction_ms,distance_cm");
}

void loop() {
  digitalWrite(LED_PIN, LOW);
  // 기다리는 시간이 일정하면 학생은 불빛이 아니라 박자를 보고 손을 냅니다.
  delay(random(2000, 6000));
  digitalWrite(LED_PIN, HIGH);
  unsigned long litAt = millis();

  long cm = -1;
  while (millis() - litAt < 3000) {
    cm = readCm();
    if (cm > 0 && cm < triggerCm) break;
  }
  digitalWrite(LED_PIN, LOW);

  Serial.print(litAt);
  Serial.print(',');
  Serial.print(millis() - litAt);
  Serial.print(',');
  Serial.println(cm);
  delay(1000);
}
