#include <Wire.h>
#include <MPU6050.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

MPU6050 imu;
// 표본 간격입니다. 걸음 하나가 0.5초쯤이므로 이보다 훨씬 촘촘해야 합니다.
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
  // 걸음 수를 스케치에서 세지 않습니다. 문턱값을 잘못 잡으면 다시 걸어야
  // 하지만, 원시 파형을 남겨 두면 문턱값만 바꿔 다시 셀 수 있습니다.
  Serial.print(last);
  Serial.print(',');
  Serial.println(sqrt(gx * gx + gy * gy + gz * gz), 4);
}
