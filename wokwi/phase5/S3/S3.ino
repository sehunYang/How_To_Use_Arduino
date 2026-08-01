// @pin PIR=D2
// @baud 9600

const byte PIR_PIN = 2;
// @tunable holdoffMs
int holdoffMs = 250;

void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:S3");
  pinMode(PIR_PIN, INPUT);
  delay(30000);
  Serial.println("time_ms,motion");
}

void loop() {
  Serial.print(millis());
  Serial.print(',');
  // 숫자 0/1로 남겨야 표 계산 프로그램에서 바로 세고 그릴 수 있습니다.
  Serial.println(digitalRead(PIR_PIN) == HIGH ? 1 : 0);
  delay(holdoffMs);
}
