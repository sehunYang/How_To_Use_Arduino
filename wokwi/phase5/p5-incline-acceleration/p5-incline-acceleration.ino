#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
MPU6050 imu;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 20;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:p5-incline-acceleration"); Wire.begin(); imu.initialize();
  Serial.println("time_ms,along_mps2,tilt_deg");
}
void loop() {
  static unsigned long last=0; if(millis()-last<samplingIntervalMs)return;
  last=millis(); int16_t ax,ay,az; imu.getAcceleration(&ax,&ay,&az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  float tilt=atan2(x,sqrt(y*y+z*z))*180.0/PI;
  Serial.print(last); Serial.print(','); Serial.print(x*9.80665,4);
  Serial.print(','); Serial.println(tilt,2);
}
