// @pin LEFT_CDS=A0
// @pin RIGHT_CDS=A1
// @baud 9600

// 표본 간격입니다. 관찰 기록과 맞추기 쉽도록 1초에서 시작합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  Serial.println("time_ms,left_adc,right_adc,error");
}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A1);
  // 두 값의 차이가 상자 안 밝기 기울기입니다. 절댓값이 아니라 차이로 보면
  // 두 CDS 개체의 성능 차이가 어느 정도 상쇄됩니다.
  Serial.print(millis());
  Serial.print(',');
  Serial.print(left);
  Serial.print(',');
  Serial.print(right);
  Serial.print(',');
  Serial.println(left - right);
  delay(samplingIntervalMs);
}
