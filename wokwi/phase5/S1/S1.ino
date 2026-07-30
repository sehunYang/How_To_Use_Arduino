#include <Wire.h>
#include <MPU6050.h>
#include <math.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 9600

MPU6050 mpu;
// @tunable samplingIntervalMs
int samplingIntervalMs = 100;

void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:S1");
  Wire.begin();
  mpu.initialize();
}

void loop() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  float roll = atan2((float)ay, (float)az) * 180.0 / PI;
  float pitch = atan2(-(float)ax, sqrt((float)ay * ay + (float)az * az)) * 180.0 / PI;
  Serial.print("roll="); Serial.print(roll, 1);
  Serial.print(", pitch="); Serial.println(pitch, 1);
  delay(samplingIntervalMs);
}
