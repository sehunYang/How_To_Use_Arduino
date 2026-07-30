// @pin HALL=A0
// @baud 9600
const byte HALL=A0;
// @tunable zeroAdc
int zeroAdc = 512;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:p6-magnetic-field-distance");
  Serial.println("time_ms,raw,signed_relative_field");
}
void loop() {
  int raw=analogRead(HALL);
  Serial.print(millis()); Serial.print(','); Serial.print(raw); Serial.print(',');
  Serial.println(raw-zeroAdc);
  delay(50);
}
