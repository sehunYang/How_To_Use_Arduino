// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600
const byte TRIG=9, ECHO=10;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 60;
float distanceM() {
  digitalWrite(TRIG,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  // 미수신은 nan 대신 -1로 표시합니다. nan 문자열은 표 계산 프로그램이
  // 숫자로 읽지 못합니다. -1인 행은 지우고 분석하세요.
  return us ? us*0.0001715 : -1.0;
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:free-fall");
  pinMode(TRIG,OUTPUT);
  pinMode(ECHO,INPUT);
  Serial.println("time_ms,distance_m");
}
void loop() {
  static unsigned long last=0;
  if (millis()-last<samplingIntervalMs) return;
  last=millis();
  Serial.print(last);
  Serial.print(',');
  Serial.println(distanceM(),4);
}
