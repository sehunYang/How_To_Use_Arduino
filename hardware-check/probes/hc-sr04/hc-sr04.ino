// 실물 점검: HC-SR04 (TRIG=D7, ECHO=D6)
// 10 Hz로 왕복 시간과 거리를 기록합니다. 메아리를 못 받으면 -1입니다.
const byte TRIG_PIN = 7, ECHO_PIN = 6;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("# PROBE hc-sr04 v1");
  Serial.println("time_ms,echo_us,distance_cm");
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(us);
  Serial.print(',');
  if (us == 0) Serial.println(-1);
  else Serial.println(us / 58.0, 1);
  delay(100);
}
