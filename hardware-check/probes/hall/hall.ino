// 실물 점검: 아날로그 홀 센서 (OUT=A0)
// 자석이 없을 때의 영점과 N극·S극 쪽 변화를 20 Hz로 기록합니다.
void setup() {
  Serial.begin(9600);
  Serial.println("# PROBE hall v1");
  Serial.println("time_ms,raw");
}

void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.println(analogRead(A0));
  delay(50);
}
