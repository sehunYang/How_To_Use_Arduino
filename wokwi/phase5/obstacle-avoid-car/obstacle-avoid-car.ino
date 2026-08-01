#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D8
// @pin ECHO=D9
// @pin LEFT_IN1=D2
// @pin LEFT_IN2=D4
// @pin RIGHT_IN3=D3
// @pin RIGHT_IN4=D7
// @pin LEFT_PWM=D5
// @pin RIGHT_PWM=D6
// @baud 9600
MPU6050 imu;
const byte TRIG=8,ECHO=9,LEFT_IN1=2,LEFT_IN2=4,RIGHT_IN3=3,RIGHT_IN4=7,LEFT_PWM=5,RIGHT_PWM=6;
// @tunable stopDistanceCm
float stopDistanceCm = 25.0;
float distanceCm() {
  digitalWrite(TRIG,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  return us ? us*0.0343/2.0 : NAN;
}
void drive(byte left, byte right) {
  // L298N은 모터 한 개당 방향 입력이 두 개입니다. 한쪽만 연결하면 나머지
  // 입력이 떠 있어 회전 방향이 정해지지 않습니다.
  digitalWrite(LEFT_IN1,HIGH);
  digitalWrite(LEFT_IN2,LOW);
  digitalWrite(RIGHT_IN3,HIGH);
  digitalWrite(RIGHT_IN4,LOW);
  analogWrite(LEFT_PWM,left);
  analogWrite(RIGHT_PWM,right);
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:obstacle-avoid-car");
  Wire.begin();
  imu.initialize();
  pinMode(TRIG,OUTPUT);
  pinMode(ECHO,INPUT);
  pinMode(LEFT_IN1,OUTPUT);
  pinMode(LEFT_IN2,OUTPUT);
  pinMode(RIGHT_IN3,OUTPUT);
  pinMode(RIGHT_IN4,OUTPUT);
  pinMode(LEFT_PWM,OUTPUT);
  pinMode(RIGHT_PWM,OUTPUT);
  Serial.println("time_ms,distance_cm,tilt_x_g");
}
// 속도 단계 실험은 이 값을 120, 150, 180처럼 바꿔 가며 반복하세요.
byte cruiseSpeed = 150;
void loop() {
  static bool avoiding=false;
  static byte missedEchoes=0;
  float d=distanceCm();
  int16_t ax,ay,az;
  imu.getAcceleration(&ax,&ay,&az);
  // 일시적인 미수신에 바로 반응하지 않도록 nan이 세 번 이어질 때만 장애물로 봅니다.
  missedEchoes = isnan(d) ? missedEchoes+1 : 0;
  if (missedEchoes >= 3 || d < stopDistanceCm) {
    // 정지까지 이동한 거리를 잴 수 있도록 먼저 완전히 멈춘 뒤 제자리에서 회전합니다.
    if (!avoiding) {
      drive(0,0);
      delay(300);
      avoiding=true;
    }
    drive(0,cruiseSpeed);
  }
  else {
    avoiding=false;
    drive(cruiseSpeed,cruiseSpeed);
  }
  Serial.print(millis());
  Serial.print(',');
  Serial.print(d,1);
  Serial.print(',');
  Serial.println(ax/16384.0,3);
  delay(80);
}
