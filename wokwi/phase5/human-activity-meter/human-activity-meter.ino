#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
MPU6050 imu;
// @tunable motionThresholdG
float motionThresholdG = 0.18;
unsigned long activeSamples = 0, totalSamples = 0;
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:human-activity-meter");
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,dynamic_g,active_fraction");
}
void loop() {
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  float dynamicG = abs(sqrt(x*x+y*y+z*z) - 1.0);
  totalSamples++;
  if (dynamicG >= motionThresholdG) activeSamples++;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(dynamicG, 4);
  Serial.print(',');
  Serial.println(activeSamples / (float)totalSamples, 4);
  delay(50);
}
