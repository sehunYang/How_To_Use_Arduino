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
  // 센서가 I2C에 응답하는지 확인합니다. 선이 빠져도 0이나 65535 같은 그럴듯한 값이 계속 나와 고장을 알아채기 어렵습니다.
  Wire.beginTransmission(0x68);
  if(Wire.endTransmission()!=0)Serial.println("# MPU6050_ERROR");
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
