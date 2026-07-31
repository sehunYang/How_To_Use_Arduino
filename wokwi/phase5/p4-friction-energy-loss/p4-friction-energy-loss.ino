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
  return us ? us*0.0001715 : NAN;
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:p4-friction-energy-loss");
  Wire.begin();
  imu.initialize();
  pinMode(TRIG,OUTPUT);
  pinMode(ECHO,INPUT);
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
