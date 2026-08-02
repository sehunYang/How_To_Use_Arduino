// @pin PIR=D2
// @baud 9600

const byte PIR_PIN = 2;
// @tunable holdoffMs
int holdoffMs = 250;

void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:S3");
  pinMode(PIR_PIN, INPUT);
  // 안정화되는 30초 동안 화면이 비어 있으면 고장으로 오해합니다.
  // 헤더와 안내를 먼저 내보내고 기다립니다.
  Serial.println("time_ms,motion");
  Serial.println("# 센서가 안정될 때까지 30초 기다립니다. 그동안 감지 범위를 비워 두세요.");
  delay(30000);
}

void loop() {
  Serial.print(millis());
  Serial.print(',');
  // 숫자 0/1로 남겨야 표 계산 프로그램에서 바로 세고 그릴 수 있습니다.
  Serial.println(digitalRead(PIR_PIN) == HIGH ? 1 : 0);
  delay(holdoffMs);
}
