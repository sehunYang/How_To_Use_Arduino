// 실물 점검: PIR HC-SR501 (OUT=D2)
// 30초 안정화가 끝난 뒤부터 4 Hz로 감지 여부(0/1)를 기록합니다.
const byte PIR_PIN = 2;

void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  Serial.println("# PROBE pir v1");
  Serial.println("# warmup_s=30");
  delay(30000);
  Serial.println("time_ms,motion");
}

void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.println(digitalRead(PIR_PIN) == HIGH ? 1 : 0);
  delay(250);
}
