// 실물 점검: TSL2591 (SDA=A4, SCL=A5)
// ID 레지스터(0x50)를 확인하고, 낮은 증폭·100 ms로 두 채널 원시값과 lux를 기록합니다.
#include <Wire.h>
#include <Adafruit_TSL2591.h>

Adafruit_TSL2591 tsl(2591);
bool ready = false;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.println("# PROBE tsl2591 v1");
  Wire.beginTransmission(0x29);
  Wire.write(0xA0 | 0x12);
  Wire.endTransmission(false);
  Wire.requestFrom((byte)0x29, (byte)1);
  Serial.print("# device_id=0x");
  Serial.println(Wire.available() ? Wire.read() : 0, HEX);
  ready = tsl.begin();
  if (!ready) {
    Serial.println("# begin=failed");
    return;
  }
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  Serial.println("time_ms,ch0,ch1,lux");
}

void loop() {
  if (!ready) return;
  uint32_t lum = tsl.getFullLuminosity();
  uint16_t ch1 = lum >> 16, ch0 = lum & 0xffff;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(ch0);
  Serial.print(',');
  Serial.print(ch1);
  Serial.print(',');
  Serial.println(tsl.calculateLux(ch0, ch1), 2);
  delay(380);
}
