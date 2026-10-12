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
