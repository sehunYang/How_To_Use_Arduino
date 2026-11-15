#include <Wire.h>
#include <Adafruit_INA219.h>

// @pin SDA=A4
// @pin SCL=A5
// @baud 115200

Adafruit_INA219 ina219;
// 표본 간격입니다. 손잡이가 한 바퀴 도는 동안 표본이 여러 개 들어가야 흔들림이 보입니다.
// @tunable samplingIntervalMs
unsigned long samplingIntervalMs = 100;
unsigned long prevTime = 0;
float totalEnergy_mJ = 0.0;
// 기록을 시작한 뒤 쌓인 전기 에너지

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) Serial.println("# INA219_ERROR");
  // 소형 발전기와 태양전지에 맞춘 범위(16 V, 400 mA)입니다. 전류 눈금이 0.1 mA로 촘촘해집니다.
  ina219.setCalibration_16V_400mA();
  Serial.println("time_ms,voltage_V,current_mA,power_mW,energy_mJ");
  prevTime = millis();
}

void loop() {
  unsigned long now = millis();
  if (now - prevTime < samplingIntervalMs) return;
  float dt_s = (now - prevTime) / 1000.0;
  prevTime = now;

  float voltage_V = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  // 멈춰 있을 때 잡음으로 생기는 작은 음수는 0으로 둡니다.
  if (voltage_V < 0) voltage_V = 0.0;
  if (current_mA < 0) current_mA = 0.0;

  // P = V × I 이고, V × mA = mW입니다.
  float power_mW = voltage_V * current_mA;
  // 에너지는 전력을 시간에 대해 더한 값입니다. mW × s = mJ.
  totalEnergy_mJ += power_mW * dt_s;

  Serial.print(now);
  Serial.print(',');
  Serial.print(voltage_V, 3);
  Serial.print(',');
  Serial.print(current_mA, 2);
  Serial.print(',');
  Serial.print(power_mW, 2);
  Serial.print(',');
  Serial.println(totalEnergy_mJ, 2);
}
