#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

MPU6050 imu;
// 표본 간격입니다. 감속 곡선의 기울기를 재려면 촘촘할수록 좋습니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 20;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  imu.initialize();
  // 센서가 I2C에 응답하는지 확인합니다. 선이 빠져도 0이나 65535 같은 그럴듯한 값이 계속 나와 고장을 알아채기 어렵습니다.
  Wire.beginTransmission(0x68);
  if(Wire.endTransmission()!=0)Serial.println("# MPU6050_ERROR");
  Serial.println("time_ms,gyro_z_dps");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  int16_t gx, gy, gz;
  imu.getRotation(&gx, &gy, &gz);
  // 기본 설정에서 자이로는 ±250 °/s 범위이고 눈금 하나가 131분의 1도입니다.
  // 이 범위를 넘기면 값이 평평하게 잘리므로 너무 세게 돌리지 마세요.
  Serial.print(last);
  Serial.print(',');
  Serial.println(gz / 131.0, 3);
}
