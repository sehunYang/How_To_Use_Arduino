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

  static unsigned long last=0;
  if(millis()-last<1000) return;
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
