#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600
MPU6050 imu;
const byte TRIG=9, ECHO=10;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 60;
float distanceM() {
  digitalWrite(TRIG,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  return us ? us*0.0001715 : -1.0;
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  pinMode(TRIG,OUTPUT);
  pinMode(ECHO,INPUT);
  // 센서가 I2C에 응답하는지 확인합니다. 선이 빠져도 0이나 65535 같은 그럴듯한 값이 계속 나와 고장을 알아채기 어렵습니다.
  Wire.beginTransmission(0x68);
  if(Wire.endTransmission()!=0)Serial.println("# MPU6050_ERROR");
  Serial.println("time_ms,distance_m,ax_mps2");
}
void loop() {
  static unsigned long last=0;
  if(millis()-last<samplingIntervalMs)return;
  last=millis();
  int16_t ax,ay,az;
  imu.getAcceleration(&ax,&ay,&az);
  Serial.print(last);
  Serial.print(',');
  Serial.print(distanceM(),4);
  Serial.print(',');
  Serial.println(ax*9.80665/16384.0,4);
}
