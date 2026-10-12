// @pin LEFT_CDS=A0
// @pin RIGHT_CDS=A1
// @pin IN1=D2
// @pin IN2=D4
// @pin ENA=D5
// @pin IN3=D7
// @pin IN4=D8
// @pin ENB=D6
// @baud 9600

const byte IN1 = 2, IN2 = 4, ENA = 5, IN3 = 7, IN4 = 8, ENB = 6;
const int BASE_SPEED = 140;
// 좌우 밝기 차이를 속도 차이로 바꾸는 비율입니다. 크면 민감하게 꺾습니다.
// @tunable turnGain
float turnGain = 0.35;

void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENB, OUTPUT);
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  Serial.println("time_ms,left_adc,right_adc,left_speed,right_speed");
}

void loop() {
  int left = analogRead(A0);
  int right = analogRead(A1);
  // 검은 선 위에 있는 쪽은 빛을 덜 되돌려 보내 값이 낮습니다. 그 차이만큼
  // 선 쪽 바퀴를 늦춰 차체를 선 쪽으로 되돌립니다. 왼쪽이 선 위면
  // left - right가 음수이므로 왼쪽 속도가 줄어듭니다.
  int correction = (int)((left - right) * turnGain);
  int leftSpeed = constrain(BASE_SPEED + correction, 0, 255);
  int rightSpeed = constrain(BASE_SPEED - correction, 0, 255);
  analogWrite(ENA, leftSpeed);
  analogWrite(ENB, rightSpeed);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(left);
  Serial.print(',');
  Serial.print(right);
  Serial.print(',');
  Serial.print(leftSpeed);
  Serial.print(',');
  Serial.println(rightSpeed);
  delay(50);
}
