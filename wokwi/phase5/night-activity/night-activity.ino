// @pin PIR=D2
// @pin LIGHT=A0
// @baud 9600
const byte PIR_PIN = 2, LIGHT_PIN = A0;
// @tunable darkThreshold
int darkThreshold = 350;
unsigned long darkMotionCount = 0;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:night-activity");
  pinMode(PIR_PIN, INPUT);
  Serial.println("time_ms,light_adc,motion,dark_motion_count");
  delay(30000);
}
void loop() {
  int light = analogRead(LIGHT_PIN);
  bool motion = digitalRead(PIR_PIN) == HIGH;
  if (motion && light < darkThreshold) darkMotionCount++;
  Serial.print(millis()); Serial.print(',');
  Serial.print(light); Serial.print(',');
  Serial.print(motion); Serial.print(',');
  Serial.println(darkMotionCount);
  delay(500);
}
