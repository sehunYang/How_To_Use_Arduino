// @pin PIR=D2
// @pin LIGHT=A0
// @baud 9600
const byte PIR_PIN = 2, LIGHT_PIN = A0;
// @tunable darkThreshold
int darkThreshold = 350;
unsigned long darkMotionCount = 0;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:night-activity");
  pinMode(PIR_PIN, INPUT);
  Serial.println("time_ms,light_adc,motion,dark_motion_count");
  delay(30000);
}
void loop() {
  static bool lastMotion = false;
  static unsigned long lastLog = 0;
  int light = analogRead(LIGHT_PIN);
  bool motion = digitalRead(PIR_PIN) == HIGH;
  // PIR 출력은 한 번의 움직임에도 수 초간 HIGH로 유지되므로, 표본 수가 아니라
  // LOW에서 HIGH로 바뀌는 순간만 한 사건으로 셉니다.
  if (motion && !lastMotion && light < darkThreshold) darkMotionCount++;
  // 밤새 0.5초마다 출력하면 행이 수만 개가 되어 복사해 쓸 수 없습니다.
  // 상태가 바뀔 때와 60초 주기에만 기록을 남깁니다.
  if (motion != lastMotion || millis() - lastLog >= 60000) {
    lastLog = millis();
    Serial.print(millis());
    Serial.print(',');
    Serial.print(light);
    Serial.print(',');
    Serial.print(motion);
    Serial.print(',');
    Serial.println(darkMotionCount);
  }
  lastMotion = motion;
  delay(500);
}
