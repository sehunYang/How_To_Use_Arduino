// @pin PIR=D2
// @pin SERVO=D9
// @baud 9600
const byte PIR_PIN=2,SERVO_PIN=9;
// @tunable holdOpenMs
unsigned long holdOpenMs = 3000;
unsigned long lastMotion=0;
void servoAngle(byte angle) {
  unsigned int pulse=544U+(unsigned long)angle*(2400-544)/180;
  digitalWrite(SERVO_PIN,HIGH);
  delayMicroseconds(pulse);
  digitalWrite(SERVO_PIN,LOW);
  // delayMicroseconds는 16383 µs까지만 정확합니다. 20 ms 프레임을 한 번에
  // 넣으면 주기가 무너지므로 나머지는 delay()로 채웁니다.
  delayMicroseconds(2400-pulse);
  delay(17);
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:automatic-door");
  pinMode(PIR_PIN,INPUT);
  pinMode(SERVO_PIN,OUTPUT);
  Serial.println("time_ms,door_state");
  // PIR 안정화 약 30초 동안에도 문을 닫힌 자세로 계속 붙잡아 둡니다.
  for(unsigned int i=0;i<1500;i++) servoAngle(0);
}
void loop() {
  static bool lastOpen=false;
  static unsigned long lastLog=0;
  if (digitalRead(PIR_PIN)==HIGH) lastMotion=millis();
  bool open=millis()-lastMotion < holdOpenMs;
  servoAngle(open ? 90 : 0);
  // 20 ms마다 출력하면 9600 baud를 넘겨 기록이 밀립니다. 상태 변화와 1초 주기만 남깁니다.
  if (open!=lastOpen || millis()-lastLog>=1000) {
    lastOpen=open;
    lastLog=millis();
    Serial.print(millis());
    Serial.print(',');
    Serial.println(open ? "open" : "closed");
  }
}
