// @pin TRIG=D7
// @pin ECHO=D6
// @baud 9600

const byte TRIG_PIN = 7;
const byte ECHO_PIN = 6;
// @tunable measurementIntervalMs
int measurementIntervalMs = 200;

void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:S2");
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, 30000);
  if (durationUs == 0) Serial.println("out-of-range");
  else {
    float distanceCm = durationUs * 0.0343 / 2.0;
    Serial.print("distance_cm=");
    Serial.println(distanceCm, 1);
  }
  delay(measurementIntervalMs);
}
