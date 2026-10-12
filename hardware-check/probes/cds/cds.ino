// 실물 점검: CdS 광센서 분압 회로 (A0)
// 가렸을 때와 비췄을 때의 ADC 값을 10 Hz로 기록합니다.
void setup() {
  Serial.begin(9600);
  Serial.println("# PROBE cds v1");
  Serial.println("time_ms,raw");
}

void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.println(analogRead(A0));
  delay(100);
}
