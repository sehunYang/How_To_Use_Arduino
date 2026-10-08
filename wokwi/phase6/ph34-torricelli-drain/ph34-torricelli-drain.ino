// @pin D7=D7
// @pin D6=D6
// 물 빠지는 속도와 토리첼리 법칙
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;

const byte TRIG_PIN=7,ECHO_PIN=6;
void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN,OUTPUT);
  pinMode(ECHO_PIN,INPUT);
  Serial.println("time_ms,distance_m");
}
void loop() {
  digitalWrite(TRIG_PIN,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN,LOW);
  unsigned long us=pulseIn(ECHO_PIN,HIGH,30000);
  // 미수신은 nan 대신 -1로 표시합니다. nan 문자열은 표 계산 프로그램이
  // 숫자로 읽지 못해 그래프가 조용히 깨집니다.
  float distanceM=us?us*0.000343f/2.0f:-1.0f;
  Serial.print(millis());
  Serial.print(',');
  Serial.println(distanceM,4);
  delay(samplingIntervalMs);
}
