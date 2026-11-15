#include <Wire.h>
#include <MPU6050.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 115200
MPU6050 imu;
// @tunable samplingIntervalMs
const unsigned long samplingIntervalMs = 20;
void setup() {
  Serial.begin(115200);
  Wire.begin();
  imu.initialize();
  // 센서가 I2C에 응답하는지 확인합니다. 선이 빠져도 0이나 65535 같은 그럴듯한 값이 계속 나와 고장을 알아채기 어렵습니다.
  Wire.beginTransmission(0x68);
  if(Wire.endTransmission()!=0)Serial.println("# MPU6050_ERROR");
  Serial.println("time_ms,ax,ay,az,g_norm");
}
void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float x=ax/16384.0, y=ay/16384.0, z=az/16384.0;
  Serial.print(last);
  Serial.print(',');
  Serial.print(x,4);
  Serial.print(',');
  Serial.print(y,4);
  Serial.print(',');
  Serial.print(z,4);
  Serial.print(',');
  Serial.println(sqrt(x*x+y*y+z*z),4);
}
