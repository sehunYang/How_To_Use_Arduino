// @pin RELAY=D7
// @baud 9600

const byte RELAY_PIN = 7;
// 팬을 켜 두는 시간입니다. 접점을 아끼려면 너무 짧게 두지 마세요.
// @tunable onSeconds
int onSeconds = 5;

void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  // 시작할 때 반드시 꺼진 상태로 둡니다. 전원이 들어오자마자 팬이 도는 것을 막습니다.
  digitalWrite(RELAY_PIN, LOW);
  Serial.println("time_ms,relay_state");
}

void loop() {
  digitalWrite(RELAY_PIN, HIGH);
  Serial.print(millis());
  Serial.println(",1");
  delay((unsigned long)onSeconds * 1000);

  digitalWrite(RELAY_PIN, LOW);
  Serial.print(millis());
  Serial.println(",0");
  delay((unsigned long)onSeconds * 1000);
}
