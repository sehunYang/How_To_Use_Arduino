// @pin TRIG=D7
// @pin ECHO=D6
// @baud 115200

const byte TRIG_PIN = 7, ECHO_PIN = 6;
// 표본 간격입니다. 낙하 전체가 1초 남짓이므로 촘촘해야 모양이 보입니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 50;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("time_ms,distance_cm");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);

  // 속도는 여기서 계산하지 않습니다. 거리의 차이를 시간의 차이로 나누는
  // 계산은 저장한 CSV에서 하면 되고, 그래야 잡음을 다듬는 방법을 나중에
  // 바꿔 볼 수 있습니다.
  Serial.print(last);
  Serial.print(',');
  Serial.println(us == 0 ? -1 : (long)(us / 58));
}
