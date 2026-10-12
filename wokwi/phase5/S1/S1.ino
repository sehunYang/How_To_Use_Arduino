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
  Wire.begin();
  mpu.initialize();
  // 센서가 I2C에 응답하는지 확인합니다. 선이 빠져도 0이나 65535 같은 그럴듯한 값이 계속 나와 고장을 알아채기 어렵습니다.
  Wire.beginTransmission(0x68);
  if(Wire.endTransmission()!=0)Serial.println("# MPU6050_ERROR");
  Serial.println("time_ms,roll_deg,pitch_deg");
}

void loop() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  float roll = atan2((float)ay, (float)az) * 180.0 / PI;
  float pitch = atan2(-(float)ax, sqrt((float)ay * ay + (float)az * az)) * 180.0 / PI;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(roll, 1);
  Serial.print(',');
  Serial.println(pitch, 1);
  delay(samplingIntervalMs);
}
