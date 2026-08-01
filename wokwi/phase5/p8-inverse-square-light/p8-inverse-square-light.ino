#include <Wire.h>
#include <Adafruit_TSL2591.h>
// @pin SDA=A4
// @pin SCL=A5
// @pin TRIG=D9
// @pin ECHO=D10
// @baud 9600
const byte TRIG=9,ECHO=10;
Adafruit_TSL2591 tsl(2591);
// @tunable sampleCount
const byte sampleCount = 5;
float lightLux() {
  uint32_t lum=tsl.getFullLuminosity();
  return tsl.calculateLux(lum & 0xffff, lum >> 16);
}
float distanceM() {
  digitalWrite(TRIG,LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG,LOW);
  unsigned long us=pulseIn(ECHO,HIGH,30000);
  // 미수신이 조용히 0 m가 되면 d2_times_lux도 0이 되어 표를 망칩니다.
  return us ? us*0.0001715 : -1.0;
}
void setup() {
  Serial.begin(9600);
  Serial.println("# PHASE5_READY:p8-inverse-square-light");
  Wire.begin();
  tsl.begin();
  // 0.2 m 거리의 램프는 기본 증폭(25배)의 측정 범위를 넘으므로 가장 낮은
  // 증폭으로 둡니다. 가까운 점이 포화되면 역제곱 검증이 무너집니다.
  tsl.setGain(TSL2591_GAIN_LOW);
  tsl.setTiming(TSL2591_INTEGRATIONTIME_100MS);
  pinMode(TRIG,OUTPUT);
  pinMode(ECHO,INPUT);
  Serial.println("time_ms,distance_m,mean_lux,d2_times_lux");
}
void loop() {
  float d=distanceM();
  float sum=0;
  for(byte i=0;i<sampleCount;i++) {
    sum+=lightLux();
    delay(120);
  }
  float light=sum/sampleCount;
  Serial.print(millis());
  Serial.print(',');
  Serial.print(d,4);
  Serial.print(',');
  Serial.print(light,2);
  Serial.print(',');
  Serial.println(light*d*d,3);
  delay(300);
}
