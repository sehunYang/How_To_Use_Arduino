// @pin HALL=A0
// @baud 9600

const byte HALL_PIN = A0;
// @tunable zeroLevel
int zeroLevel = 512;

void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:S10");
  Serial.println("raw,polarity,relative_strength");
}

void loop() {
  int raw = analogRead(HALL_PIN);
  int signedLevel = raw - zeroLevel;
  Serial.print(raw);
  Serial.print(',');
  Serial.print(signedLevel >= 0 ? "positive" : "negative");
  Serial.print(',');
  Serial.println(abs(signedLevel));
  delay(100);
}
