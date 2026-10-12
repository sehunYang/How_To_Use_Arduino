// 실물 점검: INA219 (SDA=A4, SCL=A5, 0.1 Ω 션트)
// 알려진 저항에 알려진 전압을 걸고 버스 전압, 션트 전압, 전류를 기록합니다.
#include <Wire.h>
#include <Adafruit_INA219.h>

Adafruit_INA219 ina219;
bool ready = false;

void setup() {
  Serial.begin(9600);
  Serial.println("# PROBE ina219 v1");
  ready = ina219.begin();
  Serial.print("# begin=");
  Serial.println(ready ? "ok" : "failed");
  if (ready) Serial.println("time_ms,bus_v,shunt_mv,current_ma");
}

void loop() {
  if (!ready) return;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(ina219.getBusVoltage_V(), 3);
  Serial.print(',');
  Serial.print(ina219.getShuntVoltage_mV(), 3);
  Serial.print(',');
  Serial.println(ina219.getCurrent_mA(), 2);
  delay(500);
}
