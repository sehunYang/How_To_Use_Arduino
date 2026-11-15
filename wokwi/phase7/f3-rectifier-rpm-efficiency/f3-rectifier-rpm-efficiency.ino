#include <Wire.h>
#include <Adafruit_INA219.h>

// @pin SDA=A4
// @pin SCL=A5
// @pin HALL=A0
// @baud 115200

Adafruit_INA219 ina219;
const int HALL_PIN = A0;
const unsigned long samplingIntervalMs = 200;
// 한 줄을 내보내는 간격

// 자석이 다가왔다고 볼 변화량입니다. 자석이 지나가도 rpm이 0이면 낮추고,
// 바퀴가 멈춰 있는데 rpm이 튀면 높이세요.
// @tunable magnetThreshold
int magnetThreshold = 60;

int baselineMag = 512;
// 자석이 없을 때의 값. 시작할 때 잽니다.
bool magnetNear = false;
unsigned long lastPassTime = 0;
unsigned long prevTime = 0;
float currentRPM = 0.0;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) Serial.println("# INA219_ERROR");
  ina219.setCalibration_16V_400mA();

  // 시작하는 동안 자석을 센서에서 멀리 두세요. 이때의 값을 기준으로 삼습니다.
  long sum = 0;
  for (int i = 0; i < 50; i++) {
    sum += analogRead(HALL_PIN);
    delay(5);
  }
  baselineMag = sum / 50;

  Serial.println("time_ms,rpm,mag_delta,voltage_V,current_mA,power_mW");
  prevTime = millis();
}

void loop() {
  unsigned long now = millis();
  int magDelta = abs(analogRead(HALL_PIN) - baselineMag);

  // 자석이 다가오는 순간 한 번만 셉니다. 멀어졌다고 볼 때는 문턱의 절반을 써서
  // 문턱 근처에서 값이 떨려도 두 번 세지 않게 합니다.
  if (magDelta > magnetThreshold && !magnetNear) {
    magnetNear = true;
    unsigned long period_ms = now - lastPassTime;
    // 50 ms 안에 다시 들어온 신호는 떨림으로 보고 버립니다.
    if (lastPassTime == 0 || period_ms > 50) {
      if (lastPassTime > 0) currentRPM = 60000.0 / period_ms;
      lastPassTime = now;
    }
  }
  else if (magDelta < magnetThreshold / 2) {
    magnetNear = false;
  }

  // 2초 넘게 자석이 지나가지 않으면 멈춘 것으로 봅니다. 그래서 30 rpm보다 느린 회전은 0으로 나옵니다.
  if (now - lastPassTime > 2000) currentRPM = 0.0;

  if (now - prevTime < samplingIntervalMs) return;
  prevTime = now;

  float voltage_V = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  if (voltage_V < 0) voltage_V = 0.0;
  if (current_mA < 0) current_mA = 0.0;
  float power_mW = voltage_V * current_mA;

  Serial.print(now);
  Serial.print(',');
  Serial.print(currentRPM, 1);
  Serial.print(',');
  Serial.print(magDelta);
  Serial.print(',');
  Serial.print(voltage_V, 3);
  Serial.print(',');
  Serial.print(current_mA, 2);
  Serial.print(',');
  Serial.println(power_mW, 2);
}
