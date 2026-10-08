// @pin IN1=D2
// @pin IN2=D4
// @pin ENA=D5
// @baud 9600

const byte IN1 = 2, IN2 = 4, ENA = 5;
// 시험할 속도 값입니다. 0은 정지, 255가 가장 빠릅니다.
// @tunable testSpeed
int testSpeed = 160;

void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);
  Serial.println("time_ms,direction,speed_value");
}

void report(const char* direction, int speed) {
  Serial.print(millis());
  Serial.print(',');
  Serial.print(direction);
  Serial.print(',');
  Serial.println(speed);
}

void loop() {
  // 방향은 IN1과 IN2의 조합이 정하고, 속도는 ENA에 보내는 값이 정합니다.
  // 둘 다 HIGH이거나 둘 다 LOW이면 모터가 멈춥니다.
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, testSpeed);
  report("forward", testSpeed);
  delay(2000);

  analogWrite(ENA, 0);
  report("stop", 0);
  delay(1000);

  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  analogWrite(ENA, testSpeed);
  report("reverse", testSpeed);
  delay(2000);

  analogWrite(ENA, 0);
  report("stop", 0);
  delay(1000);
}
