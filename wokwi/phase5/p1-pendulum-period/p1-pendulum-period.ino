#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
MPU6050 imu;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 10;
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:p1-pendulum-period");
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,ax_mps2");
}
void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  Serial.print(last);
  Serial.print(',');
  Serial.println(ax * 9.80665 / 16384.0, 4);
}
