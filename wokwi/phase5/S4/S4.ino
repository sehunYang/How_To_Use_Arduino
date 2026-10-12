// @pin LIGHT=A0
// @baud 9600

const byte LIGHT_PIN = A0;
// @tunable samples
int samples = 10;

void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,light_adc");
}

void loop() {
  long sum = 0;
  for (int i = 0; i < samples; ++i) {
    sum += analogRead(LIGHT_PIN);
    delay(5);
  }
  Serial.print(millis());
  Serial.print(',');
  Serial.println(sum / samples);
  delay(200);
}
