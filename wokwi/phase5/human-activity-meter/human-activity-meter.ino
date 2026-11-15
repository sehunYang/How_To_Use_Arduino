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
  Wire.begin();
  imu.initialize();
  // 센서가 I2C에 응답하는지 확인합니다. 선이 빠져도 0이나 65535 같은 그럴듯한 값이 계속 나와 고장을 알아채기 어렵습니다.
  Wire.beginTransmission(0x68);
  if(Wire.endTransmission()!=0)Serial.println("# MPU6050_ERROR");
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
