#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @baud 9600
Adafruit_TSL2591 tsl(2591);
const byte INA=0x40;
// @tunable panelAreaCm2
float panelAreaCm2 = 100.0;
void inaWrite(byte reg,uint16_t value) {
  Wire.beginTransmission(INA);
  Wire.write(reg);
  Wire.write(value>>8);
  Wire.write(value);
  Wire.endTransmission();
}
uint16_t inaRead(byte reg) {
  Wire.beginTransmission(INA);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(INA,(byte)2);
  byte high=Wire.read();
  byte low=Wire.read();
  // 한 식에 두 번 읽으면 순서가 정해지지 않습니다.
  return ((uint16_t)high<<8)|low;
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:p7-solar-panel-angle");
  Wire.begin();
  inaWrite(0x05,4096);
  tsl.begin();
  // 패널을 비출 만큼 강한 빛은 기본 증폭(25배)의 측정 범위를 넘습니다.
  // 가장 낮은 증폭으로 두어야 lux가 -1(포화)로 떨어지지 않습니다.
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,voltage_v,current_ma,power_mw,lux,power_density_mw_cm2");
}
void loop() {
  float voltage=(inaRead(0x02)>>3)*0.004;
  float current=(int16_t)inaRead(0x04)*0.1;
  float power=inaRead(0x03)*2.0;
  uint32_t lum=tsl.getFullLuminosity();
  float lux=tsl.calculateLux(lum & 0xffff, lum >> 16);
  Serial.print(millis());
  Serial.print(',');
  Serial.print(voltage,3);
  Serial.print(',');
  Serial.print(current,3);
  Serial.print(',');
  Serial.print(power,3);
  Serial.print(',');
  Serial.print(lux,2);
  Serial.print(',');
  Serial.println(panelAreaCm2>0 ? power/panelAreaCm2 : 0,4);
  delay(250);
}
