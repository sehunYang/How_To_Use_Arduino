// @pin A4=A4
// @pin A5=A5
#include <Wire.h>
// @baud 9600
// @pin PWM_OUT=D9
const byte PWM_OUT = 9;
const float INA_SHUNT_OHMS = 0.1f;
const char* conditionId = "R1K";
// R1K, R2K2, R4K7 중 실제 연결한 저항과 맞추세요.
// @tunable settlingMs
unsigned long settlingMs = 800;

int16_t readIna(byte reg) {
  Wire.beginTransmission(0x40);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(0x40,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return (int16_t)(((uint16_t)high<<8)|low);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(PWM_OUT, OUTPUT);
  analogWrite(PWM_OUT, 0);
  Serial.println("condition_id,duty,bus_V,shunt_mV,current_mA");
}

void loop() {
  static int duty = 26;
  analogWrite(PWM_OUT, duty);
  delay(settlingMs);

  float busV = (readIna(0x02) >> 3) * 0.004f;
  float shuntMv = readIna(0x01) * 0.01f;
  float currentMa = shuntMv / INA_SHUNT_OHMS;

  Serial.print(conditionId);
  Serial.print(',');
  Serial.print(duty);
  Serial.print(',');
  Serial.print(busV, 4);
  Serial.print(',');
  Serial.print(shuntMv, 4);
  Serial.print(',');
  Serial.println(currentMa, 3);

  duty += 26;
  if (duty > 234) {
    analogWrite(PWM_OUT, 0);
    duty = 26;
    delay(2000);
  }
}
