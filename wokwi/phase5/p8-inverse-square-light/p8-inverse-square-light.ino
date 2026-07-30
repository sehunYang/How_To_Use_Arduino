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
  digitalWrite(TRIG,LOW);delayMicroseconds(2);digitalWrite(TRIG,HIGH);
  delayMicroseconds(10);digitalWrite(TRIG,LOW);
  return pulseIn(ECHO,HIGH,30000)*0.0001715;
}
void setup() {
  Serial.begin(9600);
  Serial.println("PHASE5_READY:p8-inverse-square-light"); Wire.begin(); tsl.begin();
  pinMode(TRIG,OUTPUT);pinMode(ECHO,INPUT);
  Serial.println("distance_m,mean_lux,d2_times_lux");
}
void loop() {
  float d=distanceM();
  float sum=0;
  for(byte i=0;i<sampleCount;i++){sum+=lightLux();delay(120);}
  float light=sum/sampleCount;
  Serial.print(d,4);Serial.print(',');Serial.print(light,2);Serial.print(',');
  Serial.println(light*d*d,3); delay(300);
}
