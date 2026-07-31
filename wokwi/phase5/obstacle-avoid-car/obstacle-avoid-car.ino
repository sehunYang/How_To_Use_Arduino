#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D8
// @pin ECHO=D9
// @pin LEFT_IN=D2
// @pin RIGHT_IN=D3
// @pin LEFT_PWM=D5
// @pin RIGHT_PWM=D6
// @baud 9600
MPU6050 imu;
const byte TRIG=8,ECHO=9,LEFT_IN=2,RIGHT_IN=3,LEFT_PWM=5,RIGHT_PWM=6;
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
  digitalWrite(LEFT_IN,HIGH);
  digitalWrite(RIGHT_IN,HIGH);
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
  pinMode(LEFT_IN,OUTPUT);
  pinMode(RIGHT_IN,OUTPUT);
  pinMode(LEFT_PWM,OUTPUT);
  pinMode(RIGHT_PWM,OUTPUT);
  Serial.println("distance_cm,tilt_x_g");
}
void loop() {
  float d=distanceCm();
  int16_t ax,ay,az;
  imu.getAcceleration(&ax,&ay,&az);
  if (isnan(d) || d < stopDistanceCm) drive(0,150);
  else drive(150,150);
  Serial.print(d,1);
  Serial.print(',');
  Serial.println(ax/16384.0,3);
  delay(80);
}
