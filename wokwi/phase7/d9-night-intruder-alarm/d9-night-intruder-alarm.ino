// @pin CDS=A0
// @pin TRIG=D7
// @pin ECHO=D6
// @pin BUZZER=D8
// @baud 9600

const byte LIGHT_PIN = A0, TRIG_PIN = 7, ECHO_PIN = 6, BUZZER_PIN = 8;
// 밝기 값이 이보다 작으면 "어둡다"로 봅니다. 0(캄캄함)~1023(아주 밝음) 사이입니다.
// 교실 불을 켰을 때와 손으로 CDS를 가렸을 때의 값을 시리얼 모니터로 보고 그 사이로 정하세요.
const int darkLevel = 300;
// 이 거리보다 가까우면 "누가 다가왔다"로 봅니다.
// @tunable nearCm
int nearCm = 30;

long readCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  // 소리가 돌아오기까지 걸린 시간(µs)입니다. 왕복이므로 58로 나누면 cm가 됩니다.
  unsigned long us = pulseIn(ECHO_PIN, HIGH, 30000);
  return us == 0 ? -1 : (long)(us / 58);
}

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("time_ms,light_adc,distance_cm,is_dark,is_near,buzzer_on");
}

void loop() {
  int light = analogRead(LIGHT_PIN);
  long cm = readCm();

  // 조건 1: 어두운가?
  bool isDark = light < darkLevel;
  // 조건 2: 가까이 무언가 있는가? -1은 소리가 돌아오지 않은 것이라 가깝다고 보지 않습니다.
  bool isNear = cm > 0 && cm < nearCm;
  // 두 조건을 &&(그리고)로 묶습니다. 둘 다 참일 때만 울립니다.
  // 낮에 사람이 지나가도, 밤에 아무도 없어도 울리지 않습니다.
  bool alarm = isDark && isNear;

  if (alarm) tone(BUZZER_PIN, 2000);
  else noTone(BUZZER_PIN);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(light);
  Serial.print(',');
  Serial.print(cm);
  Serial.print(',');
  Serial.print(isDark ? 1 : 0);
  Serial.print(',');
  Serial.print(isNear ? 1 : 0);
  Serial.print(',');
  Serial.println(alarm ? 1 : 0);
  delay(200);
}
