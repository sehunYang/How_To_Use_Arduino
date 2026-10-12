// @pin A0=A0
// 자기 차폐 재료 비교
// @baud 9600
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;

void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,hall_raw");
}
void loop() {
  Serial.print(millis());
  Serial.print(',');
  Serial.println(analogRead(A0));
  delay(samplingIntervalMs);
}
