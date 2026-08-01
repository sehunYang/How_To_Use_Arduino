// @pin OUT=A0
// @baud 9600
const byte HALL_PIN=A0;
const int magnetThreshold=400;
const int releaseThreshold=500;
unsigned long pulseCount=0;
// @tunable pulsesPerRevolution
unsigned int pulsesPerRevolution = 1;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:rpm-meter");
  Serial.println("time_ms,pulses,rpm");
}
void loop() {
  static bool magnetDetected=false;
  int hallValue=analogRead(HALL_PIN);
  if(!magnetDetected && hallValue<=magnetThreshold) {
    pulseCount++;
    magnetDetected=true;
  }
  else if(magnetDetected && hallValue>=releaseThreshold) {
    magnetDetected=false;
  }

  // 측정 창 실험은 이 값을 1000(1초)과 5000(5초)으로 바꿔 가며 반복하세요.
  const unsigned long windowMs = 1000;
  static unsigned long last=0;
  if(millis()-last<windowMs) return;
  unsigned long elapsed=millis()-last;
  last=millis();
  unsigned long pulses=pulseCount;
  pulseCount=0;
  float rpm=pulsesPerRevolution ? pulses*60000.0/(elapsed*pulsesPerRevolution) : 0;
  Serial.print(last);
  Serial.print(',');
  Serial.print(pulses);
  Serial.print(',');
  Serial.println(rpm,1);
}
