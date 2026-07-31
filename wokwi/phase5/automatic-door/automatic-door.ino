// @pin PIR=D2
// @pin SERVO=D9
// @baud 9600
const byte PIR_PIN=2,SERVO_PIN=9;
// @tunable holdOpenMs
unsigned long holdOpenMs = 3000;
unsigned long lastMotion=0;
void servoAngle(byte angle) {
  unsigned int pulse=544UL+(unsigned long)angle*(2400-544)/180;
  digitalWrite(SERVO_PIN,HIGH);
  delayMicroseconds(pulse);
  digitalWrite(SERVO_PIN,LOW);
  delayMicroseconds(20000-pulse);
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:automatic-door");
  pinMode(PIR_PIN,INPUT);
  pinMode(SERVO_PIN,OUTPUT);
  for(byte i=0;i<25;i++) servoAngle(0);
  delay(30000);
  Serial.println("time_ms,door_state");
}
void loop() {
  if (digitalRead(PIR_PIN)==HIGH) lastMotion=millis();
  bool open=millis()-lastMotion < holdOpenMs;
  servoAngle(open ? 90 : 0);
  Serial.print(millis());
  Serial.print(',');
  Serial.println(open ? "open" : "closed");
}
