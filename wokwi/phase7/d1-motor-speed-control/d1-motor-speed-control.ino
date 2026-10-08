// @pin HALL=A0
// @pin IN1=D2
// @pin IN2=D4
// @pin ENA=D5
// @baud 9600

const byte HALL_PIN = A0, IN1 = 2, IN2 = 4, ENA = 5;
// 유지하려는 목표 회전수입니다. 모터가 낼 수 있는 범위 안에서 정하세요.
// @tunable targetRpm
int targetRpm = 120;

int speedValue = 150;
unsigned long windowStart = 0;
int pulses = 0;
bool wasNear = false;

void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, speedValue);
  windowStart = millis();
  Serial.println("time_ms,rpm,speed_value,rpm_error");
}

void loop() {
  // 자석이 지나가면 홀 센서 값이 영점에서 크게 벗어납니다. 한 번 지나갈 때
  // 여러 번 세지 않도록, 벗어난 상태에서 돌아온 순간에만 하나로 셉니다.
  bool near = abs(analogRead(HALL_PIN) - 512) > 80;
  if (near && !wasNear) pulses++;
  wasNear = near;

  if (millis() - windowStart >= 1000) {
    int rpm = pulses * 60;
    int rpmError = targetRpm - rpm;
    // 모자라면 조금 올리고 넘치면 조금 내립니다. 한 번에 크게 고치면
    // 목표를 지나쳐 위아래로 출렁입니다.
    speedValue += rpmError > 0 ? 5 : -5;
    speedValue = constrain(speedValue, 0, 255);
    analogWrite(ENA, speedValue);

    Serial.print(millis());
    Serial.print(',');
    Serial.print(rpm);
    Serial.print(',');
    Serial.print(speedValue);
    Serial.print(',');
    Serial.println(rpmError);

    pulses = 0;
    windowStart = millis();
  }
}
