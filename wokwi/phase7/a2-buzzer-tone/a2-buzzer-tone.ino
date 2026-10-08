// @pin BUZZER=D8
// @baud 9600

const byte BUZZER_PIN = 8;
// 내보낼 소리의 높이입니다. 값이 클수록 높은 소리가 납니다.
// @tunable toneHz
int toneHz = 880;

void setup() {
  Serial.begin(9600);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("time_ms,tone_hz,buzzer_on");
}

void loop() {
  // tone()은 정해진 높이의 소리를 계속 냅니다. noTone()으로 멈춥니다.
  tone(BUZZER_PIN, toneHz);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(toneHz);
  Serial.println(",1");
  delay(500);

  noTone(BUZZER_PIN);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(toneHz);
  Serial.println(",0");
  delay(500);
}
