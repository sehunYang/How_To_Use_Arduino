#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

MPU6050 imu;
// 표본 간격입니다. 한 주기에 표본이 50개는 들어가야 봉우리가 뚜렷합니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 20;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  imu.initialize();
  Serial.println("time_ms,g_norm");
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < samplingIntervalMs) return;
  last = millis();

  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 최하점을 지날 때마다 가속도 크기에 봉우리가 하나씩 생깁니다. 봉우리의
  // 높이가 줄어드는 모양이 이 탐구가 보려는 것입니다.
  Serial.print(last);
  Serial.print(',');
  Serial.println(sqrt(gx * gx + gy * gy + gz * gz), 4);
}
