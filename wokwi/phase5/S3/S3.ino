// @pin PIR=D2
// @baud 9600

const byte PIR_PIN = 2;
// @tunable holdoffMs
int holdoffMs = 250;

void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:S3");
  pinMode(PIR_PIN, INPUT);
  delay(30000);
}

void loop() {
  Serial.println(digitalRead(PIR_PIN) == HIGH ? "motion" : "clear");
  delay(holdoffMs);
}
