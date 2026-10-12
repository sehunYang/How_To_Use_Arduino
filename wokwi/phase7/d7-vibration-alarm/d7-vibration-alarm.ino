#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin BUZZER=D8
// @baud 9600

MPU6050 imu;
const byte BUZZER_PIN = 8;
// 이 크기를 넘는 흔들림을 침입으로 봅니다. 값이 작을수록 예민해집니다.
// @tunable triggerG
float triggerG = 0.08;

unsigned long alarmUntil = 0;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.println("time_ms,dynamic_g,alarm_state");
}

void loop() {
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 정지 상태에서도 중력 1 g가 잡힙니다. 그 몫을 뺀 나머지가 흔들림입니다.
  float dynamic = fabs(sqrt(gx * gx + gy * gy + gz * gz) - 1.0);

  // 한 번 울리면 3초는 유지합니다. 문이 흔들린 한순간만 울리고 그치면
  // 사람이 알아채기 전에 끝나 버립니다.
  if (dynamic > triggerG) alarmUntil = millis() + 3000;
  bool alarming = millis() < alarmUntil;
  if (alarming) tone(BUZZER_PIN, 1500);
  else noTone(BUZZER_PIN);

  Serial.print(millis());
  Serial.print(',');
  Serial.print(dynamic, 4);
  Serial.print(',');
  Serial.println(alarming ? 1 : 0);
  delay(50);
}
