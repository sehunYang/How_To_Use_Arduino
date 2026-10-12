#include <Wire.h>
#include <MPU6050.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin ONE_WIRE=D4
// @baud 9600

MPU6050 imu;
OneWire oneWire(4);
DallasTemperature probe(&oneWire);
// 표본 간격입니다. 회복은 몇 분에 걸쳐 일어나므로 1초면 충분합니다.
// @tunable samplingIntervalMs
int samplingIntervalMs = 1000;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  imu.initialize();
  probe.begin();
  Serial.println("time_ms,skin_c,dynamic_g");
}

void loop() {
  probe.requestTemperatures();
  int16_t ax, ay, az;
  imu.getAcceleration(&ax, &ay, &az);
  float gx = ax / 16384.0, gy = ay / 16384.0, gz = az / 16384.0;
  // 정지해 있어도 중력 1 g가 잡힙니다. 그 몫을 빼야 움직임만 남습니다.
  float dynamic = sqrt(gx * gx + gy * gy + gz * gz) - 1.0;

  Serial.print(millis());
  Serial.print(',');
  Serial.print(probe.getTempCByIndex(0), 2);
  Serial.print(',');
  Serial.println(dynamic, 4);
  delay(samplingIntervalMs);
}
