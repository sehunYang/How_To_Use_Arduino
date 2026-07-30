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
  Serial.println("PHASE5_READY:p2-mechanical-energy"); Wire.begin(); imu.initialize();
  Serial.println("time_ms,ax,ay,az,g_norm");
}
void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();
  int16_t ax, ay, az; imu.getAcceleration(&ax, &ay, &az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  Serial.print(last); Serial.print(','); Serial.print(x,4); Serial.print(',');
  Serial.print(y,4); Serial.print(','); Serial.print(z,4); Serial.print(',');
  Serial.println(sqrt(x*x+y*y+z*z),4);
}
